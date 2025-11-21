import { Port } from "../pitcher-protocol/messages/port";
import { Emitter, EmitterSubscription, Event } from "../utils/event";
import { SandboxSession } from "../types";
import { Disposable } from "../utils/disposable";
import { Client, createClient, createConfig } from "../api-clients/pint/client";
import {
  IAgentClient,
  IAgentClientPorts,
  IAgentClientShells,
  IAgentClientState,
  IAgentClientFS,
  IAgentClientSetup,
  IAgentClientTasks,
  IAgentClientSystem,
  PickRawFsResult,
} from "../agent-client-interface";
import {
  listPorts,
  PortInfo,
  PortsListResponse,
  streamPortsList,
} from "../api-clients/pint";



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
      client: this.apiClient,
      signal: abortController.signal,
      headers: {
        headers: { Accept: "text/event-stream" },
      },
    }).then(async ({ stream }) => {
      for await (const evt of stream) {
        const data = parseStreamEvent<PortsListResponse>(evt);

        fire(
          data.ports.map((pintPort) => ({
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
  setup: IAgentClientSetup;
  tasks: IAgentClientTasks;
  system: IAgentClientSystem;

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
    this.shells = {} as IAgentClientShells; // Not implemented for Pint
    this.fs = {} as IAgentClientFS; // Not implemented for Pint  
    this.tasks = {} as IAgentClientTasks; // Not implemented for Pint
    this.setup = {} as IAgentClientSetup; // Not implemented for Pint
    this.system = {} as IAgentClientSystem; // Not implemented for Pint
  }

  ping(): void {}
  async reconnect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  dispose(): void {}
}