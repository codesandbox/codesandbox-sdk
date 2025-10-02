import {
  IAgentClient,
  IAgentClientPorts,
  IAgentClientState,
} from "../agent-client-interface";
import { Port } from "../pitcher-protocol/messages/port";
import { listPorts, listPortsSse } from "../api-clients/pint";
import { SandboxSession } from "../types";
import { Emitter, EmitterSubscription, Event } from "../utils/event";
import { Disposable } from "../utils/disposable";
import { Client, createClient, createConfig } from "../api-clients/pint/client";

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
  shells: any = null; // TODO: Implement
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
  }

  ping(): void {}
  async reconnect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  dispose(): void {}
}
