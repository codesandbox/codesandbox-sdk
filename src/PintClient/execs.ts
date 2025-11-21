import { Client } from "../api-clients/pint/client";
import { Emitter, EmitterSubscription } from "../utils/event";
import { Disposable } from "../utils/disposable";
import { parseStreamEvent } from "./utils";
import {
    IAgentClientShells,
} from "../agent-client-interface";
import {
  createExec,
  ExecItem,
  ExecListResponse,
  getExec,
  getExecOutput,
  listExecs,
  deleteExec,
  updateExec,
  execExecStdin,
  streamExecsList,
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
        const execListResponse = parseStreamEvent<ExecListResponse>(evt);
        const execs = execListResponse.execs;

        if (prevExecs && execs) {
          execs.forEach((exec) => {
            const prevExec = prevExecs?.find(
              (execItem) => execItem.id === exec.id
            );

            compare(exec, prevExec, prevExecs);
          });
        }

        prevExecs = execs || [];
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
  async create(
    projectPath: string,
    size: ShellSize,
    command?: string,
    type?: ShellProcessType,
    isSystemShell?: boolean
  ): Promise<OpenShellDTO> {
    // For Pint, we need to construct args from command
    const args = command ? command.split(' ').slice(1) : [];
    const baseCommand = command ? command.split(' ')[0] : 'bash';
    const exec = await createExec({
      client: this.apiClient,
      body: {
        args,
        command: baseCommand,
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
  async delete(shellId: ShellId): Promise<CommandShellDTO | TerminalShellDTO | null> {
    try {
      // First get the exec details before deleting it
      const exec = await getExec({
        client: this.apiClient,
        path: {
          id: shellId,
        },
      });

      if (!exec.data) {
        return null; // Exec doesn't exist
      }

      // Convert to shell DTO before deletion
      const shellDTO = this.convertExecToShellDTO(exec.data);

      // Delete the exec
      const deleteResponse = await deleteExec({
        client: this.apiClient,
        path: {
          id: shellId,
        },
      });

      if (deleteResponse.data) {
        // Clean up any open shells reference
        if (this.openShells[shellId]) {
          this.openShells[shellId].abort();
          delete this.openShells[shellId];
        }

        return shellDTO as CommandShellDTO | TerminalShellDTO;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Failed to delete shell:", error);
      return null;
    }
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
      
      if (!buffer.length) {
        buffer.push(data.output);
        break;
      }
    }

    return {
      buffer,
      ...this.convertExecToShellDTO(exec.data),
    };
  }
  async rename(shellId: ShellId, name: string): Promise<null> {
    return null;
  }
  async restart(shellId: ShellId): Promise<null> {
    try {
      await updateExec({
        client: this.apiClient,
        path: {
          id: shellId,
        },
        body: {
          status: 'running',
        },
      });

      return null;
    } catch (error) {
      console.error("Failed to restart shell:", error);
      return null;
    }
  }
  async send(shellId: ShellId, input: string, size: ShellSize): Promise<null> {
    try {
      await execExecStdin({
        client: this.apiClient,
        path: {
          id: shellId,
        },
        body: {
          type: 'stdin',
          input: input,
        },
      });

      return null;
    } catch (error) {
      console.error("Failed to send input to shell:", error);
      return null;
    }
  }
}
