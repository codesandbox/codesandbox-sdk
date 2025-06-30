import { Disposable } from "../utils/disposable";
import { Emitter } from "../utils/event";
import { IAgentClient } from "../node/agent-client-interface";

export type Port = {
  host: string;
  port: number;
};

export class Ports {
  private disposable = new Disposable();
  private onDidPortOpenEmitter = this.disposable.addDisposable(
    new Emitter<Port>()
  );
  get onDidPortOpen() {
    return this.onDidPortOpenEmitter.event;
  }
  private onDidPortCloseEmitter = this.disposable.addDisposable(
    new Emitter<number>()
  );
  get onDidPortClose() {
    return this.onDidPortCloseEmitter.event;
  }

  private lastOpenedPorts: Set<number> = new Set();

  constructor(
    sessionDisposable: Disposable,
    private agentClient: IAgentClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });

    agentClient.ports.getPorts().then((ports) => {
      ports.forEach((port) => {
        this.lastOpenedPorts.add(port.port);
      });
    });

    this.disposable.addDisposable(
      agentClient.ports.onPortsUpdated((ports) => {
        const openedPorts = ports.filter(
          (port) => !this.lastOpenedPorts.has(port.port)
        );

        const closedPorts = [...this.lastOpenedPorts].filter(
          (port) => !ports.some((p) => p.port === port)
        );

        if (openedPorts.length) {
          for (const port of openedPorts) {
            this.onDidPortOpenEmitter.fire({
              port: port.port,
              host: port.url,
            });
          }
        }

        if (closedPorts.length) {
          for (const port of closedPorts) {
            this.onDidPortCloseEmitter.fire(port);
          }
        }

        this.lastOpenedPorts = new Set(ports.map((port) => port.port));
      })
    );
  }

  /**
   * Get a port by number.
   */
  async get(port: number) {
    const ports = await this.getAll();

    return ports.find((p) => p.port === port);
  }

  /**
   * Get all ports.
   */
  async getAll(): Promise<Port[]> {
    const ports = await this.agentClient.ports.getPorts();

    return ports.map(({ port, url }) => ({ port, host: url }));
  }

  /**
   * Wait for a port to be opened.
   *
   * @param port - The port to wait for.
   * @param options - Additional options
   * @param options.timeoutMs - Optional timeout in milliseconds. If specified, the promise will reject after this time if the port hasn't opened.
   * @returns A promise that resolves when the port is opened.
   * @throws {Error} If the timeout is reached before the port opens
   */
  async waitForPort(
    port: number,
    options?: { timeoutMs?: number }
  ): Promise<Port> {
    return new Promise(async (resolve, reject) => {
      // Check if port is already open
      const portInfo = (await this.getAll()).find((p) => p.port === port);

      if (portInfo) {
        resolve(portInfo);
        return;
      }

      // Set up timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (options?.timeoutMs !== undefined) {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Timeout of ${options.timeoutMs}ms exceeded waiting for port ${port} to open`
            )
          );
        }, options.timeoutMs);
      }

      // Listen for port open events
      const disposable = this.disposable.addDisposable(
        this.onDidPortOpen((portInfo) => {
          if (portInfo.port === port) {
            if (timeoutId !== undefined) {
              clearTimeout(timeoutId);
            }
            resolve(portInfo);
            disposable.dispose();
          }
        })
      );
    });
  }
}
