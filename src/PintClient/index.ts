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
  listExecs,
  listPorts,
  listPortsSse,
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

class PintPortsClient implements IAgentClientPorts {
  private onPortsUpdatedEmitter = new EmitterSubscription<Port[]>((fire) => {
    const abortController = new AbortController();

    listPortsSse({
      signal: abortController.signal,
      headers: {
        headers: { Accept: "text/event-stream" },
      },
    }).then(async ({ stream }) => {
      for await (const evt of stream) {
        const evtWithoutDataPrefix = evt.substring(5);

        fire(JSON.parse(evtWithoutDataPrefix));
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
  private onShellExitedEmitter = new EmitterSubscription<{
    shellId: string;
    exitCode: number;
  }>(() => {
    return Disposable.create(() => {});
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
    console.log("creating shell", { args, command, type });
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
  open(shellId: ShellId, size: ShellSize): Promise<OpenShellDTO> {
    throw new Error("Not implemented");
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
