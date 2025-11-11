
import { Port } from "../pitcher-protocol/messages/port";
import { SandboxSession } from "../types";
import { Emitter, EmitterSubscription, Event } from "../utils/event";
import { Disposable } from "../utils/disposable";
import { Client, createClient, createConfig } from "../api-clients/pint/client";
import {
  IAgentClient,
  IAgentClientPorts,
  IAgentClientShells,
  IAgentClientState,
  IAgentClientFS,
  PickRawFsResult,
} from "../agent-client-interface";
import {
  createExec,
  ExecItem,
  ExecListResponse,
  getExec,
  getExecOutput,
  listExecs,
  listPorts,
  PortInfo,
  streamExecsList,
  streamPortsList,
  createFile,
  readFile,
  deleteFile,
  performFileAction,
  listDirectory,
  createDirectory,
  deleteDirectory,

} from "../api-clients/pint";

import {
  ShellSize,
  ShellProcessType,
  OpenShellDTO,
  CommandShellDTO,
  ShellId,
  TerminalShellDTO,
  ShellDTO,
  ShellProcessStatus,
} from "../pitcher-protocol/messages/shell";
import { 
  FSReadFileParams, 
  FSReadFileResult, 
  FSReadDirParams, 
  FSReadDirResult, 
  FSReadDirMessage, 
  FSWriteFileParams, 
  FSWRiteFileResult,   
} from "../pitcher-protocol/messages/fs";

function parseStreamEvent<T>(evt: unknown): T {
  if (typeof evt !== "string") {
    return evt as T;
  }

  const evtWithoutDataPrefix = evt.substring(5);

  return JSON.parse(evtWithoutDataPrefix);
}

class PintPortsClient implements IAgentClientPorts {
  private onPortsUpdatedEmitter = new EmitterSubscription<Port[]>((fire) => {
    const abortController = new AbortController();

    streamPortsList({
      signal: abortController.signal,
      headers: {
        headers: { Accept: "text/event-stream" },
      },
    }).then(async ({ stream }) => {
      for await (const evt of stream) {
        const data = parseStreamEvent<PortInfo[]>(evt);

        fire(
          data.map((pintPort) => ({
            port: pintPort.port,
            url: pintPort.address,
          }))
        );
      }
    });

    return Disposable.create(() => {
      abortController.abort();
    });
  });
  onPortsUpdated = this.onPortsUpdatedEmitter.event;

  constructor(private apiClient: Client, private sandboxId: string) {}

  async getPorts(): Promise<Port[]> {
    const ports = await listPorts({
      client: this.apiClient,
    });

    return (
      ports.data?.ports.map((port) => ({
        port: port.port,
        url: `https://${this.sandboxId}-${port.port}.csb.app`,
      })) ?? []
    );
  }
}

export class PintShellsClient implements IAgentClientShells {
  private openShells: Record<string, AbortController> = {};
  private subscribeAndEvaluateExecsUpdates(
    compare: (
      nextExec: ExecItem,
      prevExec: ExecItem | undefined,
      prevExecs: ExecItem[]
    ) => void
  ) {
    let prevExecs: ExecItem[] = [];
    const abortController = new AbortController();

    streamExecsList({
      client: this.apiClient,
      signal: abortController.signal,
      headers: {
        headers: { Accept: "text/event-stream" },
      },
    }).then(async ({ stream }) => {
      for await (const evt of stream) {
        const execs = (evt as unknown as ExecListResponse).execs; // parseStreamEvent<ExecItem[]>(evt);

        if (prevExecs) {
          execs.forEach((exec) => {
            const prevExec = prevExecs?.find(
              (execItem) => execItem.id === exec.id
            );

            compare(exec, prevExec, prevExecs);
          });
        }

        prevExecs = execs;
      }
    });

    return Disposable.create(() => {
      abortController.abort();
    });
  }
  private onShellExitedEmitter = new EmitterSubscription<{
    shellId: string;
    exitCode: number;
  }>((fire) =>
    this.subscribeAndEvaluateExecsUpdates((exec, prevExec) => {
      if (!prevExec) {
        return;
      }

      if (prevExec.status === "RUNNING" && exec.status === "EXITED") {
        fire({
          shellId: exec.id,
          exitCode: exec.exitCode,
        });
      }
    })
  );
  onShellExited = this.onShellExitedEmitter.event;

  private onShellOutEmitter = new Emitter<{
    shellId: ShellId;
    out: string;
  }>();
  onShellOut = this.onShellOutEmitter.event;
  private onShellTerminatedEmitter = new EmitterSubscription<{
    shellId: string;
    author: string;
  }>((fire) =>
    this.subscribeAndEvaluateExecsUpdates((exec, prevExec) => {
      if (!prevExec) {
        return;
      }

      if (prevExec.status === "RUNNING" && exec.status === "STOPPED") {
        fire({
          shellId: exec.id,
          author: "",
        });
      }
    })
  );
  onShellTerminated = this.onShellTerminatedEmitter.event;
  constructor(private apiClient: Client, private sandboxId: string) {}
  private convertExecToShellDTO(exec: ExecItem) {
    return {
      isSystemShell: true,
      name: JSON.stringify({
        type: "command",
        command: exec.command,
        name: "",
      }),
      ownerUsername: "root",
      shellId: exec.id,
      shellType: "TERMINAL" as const,
      startCommand: exec.command,
      status: exec.status as ShellProcessStatus,
    };
  }
  async create({
    command,
    args,
    projectPath,
    size,
    type,
  }: {
    command: string;
    args: string[];
    projectPath: string;
    size: ShellSize;
    type?: ShellProcessType;
    isSystemShell?: boolean;
  }): Promise<OpenShellDTO> {
    const exec = await createExec({
      client: this.apiClient,
      body: {
        args,
        command,
        interactive: type === "COMMAND" ? false : true,
      },
    });

    if (!exec.data) {
      console.log(exec);
      throw new Error(exec.error.message);
    }

    console.log("Gotz shell", exec.data);

    await this.open(exec.data.id, { cols: 200, rows: 80 });

    return {
      ...this.convertExecToShellDTO(exec.data),
      buffer: [],
    };
  }
  delete(shellId: ShellId): Promise<CommandShellDTO | TerminalShellDTO | null> {
    throw new Error("Not implemented");
  }
  async getShells(): Promise<ShellDTO[]> {
    const execs = await listExecs({
      client: this.apiClient,
    });

    return (
      execs.data?.execs.map((exec) => this.convertExecToShellDTO(exec)) ?? []
    );
  }
  async open(shellId: ShellId, size: ShellSize): Promise<OpenShellDTO> {
    const abortController = new AbortController();

    this.openShells[shellId] = abortController;

    const exec = await getExec({
      client: this.apiClient,
      path: {
        id: shellId,
      },
    });

    if (!exec.data) {
      throw new Error(exec.error.message);
    }

    const { stream } = await getExecOutput({
      client: this.apiClient,
      path: { id: shellId },
      query: { lastSequence: 0 },
      signal: abortController.signal,
      headers: {
        Accept: "text/event-stream",
      },
    });

    const buffer: string[] = [];

    console.log("Waiting for IO");
    for await (const evt of stream) {
      const data = parseStreamEvent<{
        type: "stdout" | "stderr";
        output: "";
        sequence: number;
        timestamp: string;
      }>(evt);

      console.log("GOTZ IO", data);

      if (!buffer.length) {
        buffer.push(data.output);
        break;
      }
    }

    console.log("No IO", buffer);

    return {
      buffer,
      ...this.convertExecToShellDTO(exec.data),
    };
  }
  async rename(shellId: ShellId, name: string): Promise<null> {
    return null;
  }
  restart(shellId: ShellId): Promise<null> {
    throw new Error("Not implemented");
  }
  send(shellId: ShellId, input: string, size: ShellSize): Promise<null> {
    throw new Error("Not implemented");
  }
}

export class PintFsClient implements IAgentClientFS {
  constructor(private apiClient: Client, private sandboxId: string) {}

  async readFile(path: string): Promise<PickRawFsResult<"fs/readFile">> {
    try {
      const response = await readFile({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        // Convert string content to Uint8Array to match FSReadFileResult type
        const encoder = new TextEncoder();
        const content = encoder.encode(response.data.content);
        
        return {
          type: "ok",
          result: {
            content: content,
          },
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to read file",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async readdir(path: string): Promise<PickRawFsResult<"fs/readdir">> {
    try {
      const response = await listDirectory({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        const entries = response.data.files.map((fileInfo) => ({
          name: fileInfo.name,
          type: fileInfo.isDir ? (1 as const) : (0 as const), // 1 = directory, 0 = file
          isSymlink: false, // API doesn't provide symlink info, defaulting to false
        }));

        return {
          type: "ok",
          result: {
            entries: entries,
          },
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to read directory",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async writeFile(
    path: string,
    content: Uint8Array,
    create?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/writeFile">> {
     try {
      // Convert Uint8Array content to string for the API
      const decoder = new TextDecoder();
      const contentString = decoder.decode(content);

      const response = await createFile({
        client: this.apiClient,
        path: {
          path: path,
        },
        body: {
          content: contentString,
        },
      });

      if (response.data) {
        // FSWriteFileResult is an empty object (Record<string, never>)
        return {
          type: "ok",
          result: {},
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to write file",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

    async remove(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<"fs/remove">> {
    try {
      const response = await deleteDirectory({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        // FSRemoveResult is an empty object (Record<string, never>)
        return {
          type: "ok",
          result: {},
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to remove directory",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async mkdir(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<"fs/mkdir">> {
    try {
      const response = await createDirectory({
        client: this.apiClient,
        path: {
          path: path,
        },
      });

      if (response.data) {
        // FSMkdirResult is an empty object (Record<string, never>)
        return {
          type: "ok",
          result: {},
        };
      } else {
        return {
          type: "error",
          error: response.error?.message || "Failed to create directory",
          errno: null,
        };
      }
    } catch (error) {
      return {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        errno: null,
      };
    }
  }

  async stat(path: string): Promise<PickRawFsResult<"fs/stat">> {
    throw new Error("Not implemented");
  }

  async copy(
    from: string,
    to: string,
    recursive?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/copy">> {
    throw new Error("Not implemented");
  }

  async rename(
    from: string,
    to: string,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/rename">> {
    throw new Error("Not implemented");
  }

  async watch(
    path: string,
    options: {
      readonly recursive?: boolean;
      readonly excludes?: readonly string[];
    },
    onEvent: (watchEvent: any) => void
  ): Promise<
    | (PickRawFsResult<"fs/watch"> & { type: "error" })
    | { type: "success"; dispose(): void }
  > {
    throw new Error("Not implemented");
  }

  async download(path?: string): Promise<{ downloadUrl: string }> {
    throw new Error("Not implemented");
  }
}
export class PintClient implements IAgentClient {
  static async create(session: SandboxSession) {
    return new PintClient(session);
  }

  readonly type = "pint" as const;

  // Since there is no websocket connection or internal hibernation, the state
  // will always be CONNECTED. No state change events will be triggered
  readonly state = "CONNECTED";
  private onStateChangeEmitter = new Emitter<IAgentClientState>();
  onStateChange = this.onStateChangeEmitter.event;

  sandboxId: string;
  workspacePath: string;
  isUpToDate: boolean;

  ports: IAgentClientPorts;
  shells: IAgentClientShells;
  fs: IAgentClientFS;
  setup: any = null; // TODO: Implement
  tasks: any = null; // TODO: Implement
  system: any = null; // TODO: Implement

  constructor(session: SandboxSession) {
    this.sandboxId = session.sandboxId;
    this.workspacePath = session.workspacePath;
    this.isUpToDate = true;

    const apiClient = createClient(
      createConfig({
        baseUrl: session.pitcherURL,
        headers: {
          Authorization: `Bearer ${session.pitcherToken}`,
        },
      })
    );

    this.ports = new PintPortsClient(apiClient, this.sandboxId);
    this.shells = new PintShellsClient(apiClient, this.sandboxId);
    this.fs = new PintFsClient(apiClient, this.sandboxId);
  }

  ping(): void {}
  async reconnect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  dispose(): void {}
}
