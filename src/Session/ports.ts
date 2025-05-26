import type { IPitcherClient } from "@codesandbox/pitcher-client";

import { Disposable } from "../utils/disposable";
import { Emitter } from "../utils/event";
import { HostToken } from "../Hosts";

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
    private pitcherClient: IPitcherClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });

    pitcherClient.clients.port.getPorts().forEach((port) => {
      this.lastOpenedPorts.add(port.port);
    });

    this.disposable.addDisposable(
      pitcherClient.clients.port.onPortsUpdated((ports) => {
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
  get(port: number) {
    return this.getAll().find((p) => p.port === port);
  }

  /**
   * Get all ports.
   */
  getAll(): Port[] {
    return this.pitcherClient.clients.port
      .getPorts()
      .map(({ port, url }) => ({ port, host: url }));
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
    await this.pitcherClient.clients.port.readyPromise;

    return new Promise((resolve, reject) => {
      // Check if port is already open
      const portInfo = this.getAll().find((p) => p.port === port);

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
