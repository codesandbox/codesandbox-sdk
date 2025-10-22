import {
  IAgentClient,
  IAgentClientPorts,
  IAgentClientShells,
  IAgentClientState,
} from "../agent-client-interface";
import { Port } from "../pitcher-protocol/messages/port";
import {
  createExec,
  ExecItem,
  getExecOutput,
  listExecs,
  listPorts,
  PortInfo,
  streamExecsList,
  streamPortsList,
} from "../api-clients/pint";
import { SandboxSession } from "../types";
import { Emitter, EmitterSubscription, Event } from "../utils/event";
import { Disposable } from "../utils/disposable";
import { Client, createClient, createConfig } from "../api-clients/pint/client";
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

function parseStreamEvent<T>(evt: string): T {
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
  private onShellExitedEmitter = new EmitterSubscription<{
    shellId: string;
    exitCode: number;
  }>((fire) => {
    const abortController = new AbortController();

    let prevExecs: ExecItem[] | undefined;

    streamExecsList({
      signal: abortController.signal,
      headers: {
        headers: { Accept: "text/event-stream" },
      },
    }).then(async ({ stream }) => {
      for await (const evt of stream) {
        const execs = parseStreamEvent<ExecItem[]>(evt);

        if (prevExecs) {
          execs.forEach((exec) => {
            const prevExec = prevExecs?.find(
              (execItem) => execItem.id === exec.id
            );

            if (!prevExec) {
              return;
            }

            console.log("WTF", exec);

            if (
              prevExec.status === "RUNNING" &&
              (exec.status === "STOPPED" || exec.status === "FINISHED")
            ) {
              fire({
                shellId: exec.id,
                exitCode: 0,
              });
            }
          });
        }

        prevExecs = execs;
      }
    });

    return Disposable.create(() => {
      abortController.abort();
    });
  });
  onShellExited = this.onShellExitedEmitter.event;
  private onShellOutEmitter = new EmitterSubscription<{
    shellId: ShellId;
    out: string;
  }>(() => {
    return Disposable.create(() => {});
  });
  onShellOut = this.onShellOutEmitter.event;
  private onShellTerminatedEmitter = new EmitterSubscription<{
    shellId: ShellId;
    author: string;
  }>(() => {
    return Disposable.create(() => {});
  });
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
      throw new Error("Nooooooooo");
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

    getExecOutput({
      path: { id: shellId },
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

    return {};
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

export class PintClient implements IAgentClient {
  static async create(session: SandboxSession) {
    return new PintClient(session);
  }

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
  fs: any = null; // TODO: Implement
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
  }

  ping(): void {}
  async reconnect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  dispose(): void {}
}
