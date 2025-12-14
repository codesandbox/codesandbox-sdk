import { Client } from "../api-clients/pint/client";
import { Emitter, EmitterSubscription } from "../utils/event";
import { Disposable } from "../utils/disposable";
import { parseStreamEvent } from "./utils";
import {
  IAgentClientShells,
  SubscribeShellEvent,
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
import { IDisposable } from "@xterm/headless";

export class PintShellsClient implements IAgentClientShells {
  private execs: ExecItem[] = [];
  constructor(private apiClient: Client, private sandboxId: string) {}
  private subscribeAndEvaluateExecsUpdates(
    execId: string,
    compare: (
      nextExec: ExecItem,
      prevExec: ExecItem | undefined,
      prevExecs: ExecItem[]
    ) => void
  ) {
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

        execs.forEach((exec) => {
          if (exec.id !== execId) {
            return;
          }

          const prevExec = this.execs.find(
            (execItem) => execItem.id === exec.id
          );

          compare(exec, prevExec, this.execs);
        });

        this.execs = execs;
      }
    });

    return Disposable.create(() => {
      abortController.abort();
    });
  }
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
      throw new Error(exec.error.message);
    }

    this.execs.push(exec.data);

    return {
      ...this.convertExecToShellDTO(exec.data),
      buffer: [],
    };
  }
  subscribe(
    shellId: ShellId,
    listener: (event: SubscribeShellEvent) => void
  ): IDisposable {
    return this.subscribeAndEvaluateExecsUpdates(shellId, (exec, prevExec) => {
      if (!prevExec) {
        return;
      }

      if (prevExec.status === "RUNNING" && exec.status === "EXITED") {
        listener({
          type: "exit",
          exitCode: exec.exitCode,
        });
      }
    });
  }
  subscribeOutput(
    shellId: ShellId,
    size: ShellSize,
    listener: (event: { out: string; exitCode?: number }) => void
  ): IDisposable {
    const disposable = new Disposable();
    const abortController = new AbortController();

    getExecOutput({
      client: this.apiClient,
      path: { id: shellId },
      query: { lastSequence: 0 },
      signal: abortController.signal,
      headers: {
        Accept: "text/event-stream",
      },
    }).then(async ({ stream }) => {
      for await (const evt of stream) {
        const data = parseStreamEvent<{
          type: "stdout" | "stderr";
          output: "";
          sequence: number;
          timestamp: string;
          exitCode?: number;
        }>(evt);

        listener({ out: data.output, exitCode: data.exitCode });
      }
    });

    disposable.onDidDispose(() => {
      abortController.abort();
    });

    return disposable;
  }
  async delete(
    shellId: ShellId
  ): Promise<CommandShellDTO | TerminalShellDTO | null> {
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
        return shellDTO as CommandShellDTO | TerminalShellDTO;
      } else {
        return null;
      }
    } catch (error) {
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
          status: "running",
        },
      });

      return null;
    } catch (error) {
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
          type: "stdin",
          input: input,
        },
      });

      return null;
    } catch (error) {
      return null;
    }
  }
}
