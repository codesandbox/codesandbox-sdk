import type { IPitcherClient } from "@codesandbox/pitcher-client";

import { Disposable } from "./utils/disposable";
import { Emitter } from "./utils/event";

export class PortInfo {
  constructor(public port: number, public hostname: string) {}

  getPreviewUrl(protocol = "https://"): string {
    return `${protocol}${this.hostname}`;
  }

  /**
   * Get a signed preview URL using a preview token. Private sandbox previews are inaccessible
   * unless a preview token is provided in the URL (or as a header `csb-preview-token` or cookie
   * `csb_preview_token`).
   *
   * @param token - The preview token to sign the URL with
   * @param protocol - The protocol to use for the preview URL, defaults to `https://`
   * @returns The signed preview URL
   */
  getSignedPreviewUrl(token: string, protocol = "https://"): string {
    return `${this.getPreviewUrl(protocol)}?preview_token=${token}`;
  }
}

export class Ports extends Disposable {
  private onDidPortOpenEmitter = this.addDisposable(new Emitter<PortInfo>());
  get onDidPortOpen() {
    return this.onDidPortOpenEmitter.event;
  }

  private onDidPortCloseEmitter = this.addDisposable(new Emitter<number>());
  get onDidPortClose() {
    return this.onDidPortCloseEmitter.event;
  }

  private lastOpenedPorts: Set<number> = new Set();

  constructor(private pitcherClient: IPitcherClient) {
    super();

    pitcherClient.clients.port.getPorts().forEach((port) => {
      this.lastOpenedPorts.add(port.port);
    });

    this.addDisposable(
      pitcherClient.clients.port.onPortsUpdated((ports) => {
        const openedPorts = ports
          .filter((port) => !this.lastOpenedPorts.has(port.port))
          .map((port) => new PortInfo(port.port, port.url));

        const closedPorts = [...this.lastOpenedPorts].filter(
          (port) => !ports.some((p) => p.port === port)
        );

        if (openedPorts.length) {
          for (const port of openedPorts) {
            this.onDidPortOpenEmitter.fire(port);
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

  getOpenedPort(port: number): PortInfo | undefined {
    return this.getOpenedPorts().find((p) => p.port === port);
  }

  getOpenedPorts(): PortInfo[] {
    return this.pitcherClient.clients.port
      .getPorts()
      .map((port) => new PortInfo(port.port, port.url));
  }

  getPreviewUrl(port: number, protocol = "https://"): string | undefined {
    const hostname = this.pitcherClient.clients.port
      .getPorts()
      .find((p) => p.port === port)?.url;

    return hostname ? `${protocol}${hostname}` : undefined;
  }

  /**
   * Wait for a port to be opened.
   *
   * @param port - The port to wait for.
   * @returns A promise that resolves when the port is opened.
   */
  async waitForPort(port: number): Promise<PortInfo> {
    await this.pitcherClient.clients.port.readyPromise;

    return new Promise((resolve) => {
      const portInfo = this.getOpenedPorts().find((p) => p.port === port);
      if (portInfo) {
        resolve(portInfo);
        return;
      }

      const disposable = this.addDisposable(
        this.onDidPortOpen((portInfo) => {
          if (portInfo.port === port) {
            resolve(portInfo);
            disposable.dispose();
          }
        })
      );
    });
  }

  /**
   * Get a signed preview URL for a port using a preview token.
   *
   * @param port - The port to get a signed preview URL for
   * @param token - The preview token to sign the URL with
   * @returns The signed preview URL, or undefined if the port is not open
   * @throws {Error} If the port is not open
   */
  getSignedPreviewUrl(
    port: number,
    token: string,
    protocol = "https://"
  ): string {
    const portInfo = this.getOpenedPort(port);
    if (!portInfo) {
      throw new Error("Port is not open");
    }

    return portInfo.getSignedPreviewUrl(token, protocol);
  }
}
