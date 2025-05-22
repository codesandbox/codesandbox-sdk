import { Disposable } from "../../utils/disposable";
import {
  protocol as _protocol,
  type IPitcherClient,
} from "@codesandbox/pitcher-client";

import { FileSystem } from "./filesystem";
import { Ports } from "./ports";
import { Setup } from "./setup";
import { Tasks } from "./tasks";
import { Interpreters } from "./interpreters";
import { Terminals } from "./terminals";
import { Commands } from "./commands";
import { Git } from "./git";
import { HostToken } from "../../Hosts";
import { Hosts } from "./hosts";

export * from "./filesystem";
export * from "./ports";
export * from "./setup";
export * from "./tasks";
export * from "./terminals";
export * from "./commands";
export * from "./git";
export * from "./interpreters";
export * from "./hosts";

export class WebSocketSession {
  private disposable = new Disposable();

  /**
   * Namespace for all filesystem operations on this Sandbox
   */
  public readonly fs: FileSystem;

  /**
   * Namespace for hosts
   */
  public readonly hosts: Hosts;

  /**
   * Namespace for creating and managing terminals this Sandbox
   */
  public readonly terminals: Terminals;

  /**
   * Namespace for running commands in the Sandbox
   */
  public readonly commands: Commands;

  /**
   * Namespace for running code interpreters in the Sandbox
   */
  public readonly interpreters: Interpreters;

  /**
   * Namespace for Git operations in the Sandbox
   */
  public readonly git: Git;

  /**
   * Namespace for managing ports on this Sandbox
   */
  public readonly ports = new Ports(this.disposable, this.pitcherClient);

  /**
   * Namespace for the setup that runs when the Sandbox starts from scratch.
   */
  public readonly setup = new Setup(this.disposable, this.pitcherClient);

  /**
   * Namespace for tasks that are defined in the Sandbox.
   */
  public readonly tasks = new Tasks(this.disposable, this.pitcherClient);

  constructor(
    protected pitcherClient: IPitcherClient,
    {
      env,
      hostToken,
      sessionId,
    }: {
      env?: Record<string, string>;
      hostToken?: HostToken;
      sessionId?: string;
    }
  ) {
    // TODO: Bring this back once metrics polling does not reset inactivity
    // const metricsDisposable = {
    //   dispose:
    //     this.pitcherClient.clients.system.startMetricsPollingAtInterval(5000),
    // };

    // this.addDisposable(metricsDisposable);
    this.fs = new FileSystem(this.disposable, this.pitcherClient, sessionId);
    this.terminals = new Terminals(this.disposable, this.pitcherClient, env);
    this.commands = new Commands(this.disposable, this.pitcherClient, env);

    this.hosts = new Hosts(this.pitcherClient, hostToken);
    this.interpreters = new Interpreters(this.disposable, this.commands);
    this.git = new Git(this.pitcherClient, this.commands);
    this.disposable.addDisposable(this.pitcherClient);
  }

  /**
   * The current state of the Sandbox
   */
  get state(): typeof this.pitcherClient.state {
    return this.pitcherClient.state;
  }

  /**
   * An event that is emitted when the state of the Sandbox changes.
   */
  get onStateChange() {
    return this.pitcherClient.onStateChange.bind(this.pitcherClient);
  }

  /**
   * Check if the Sandbox Agent process is up to date. To update a restart is required
   */
  get isUpToDate() {
    return this.pitcherClient.isUpToDate();
  }

  /**
   * The ID of the sandbox.
   */
  get id(): string {
    return this.pitcherClient.instanceId;
  }

  /**
   * Get the URL to the editor for this sandbox. Keep in mind that this URL is not
   * available if the sandbox is private, and the user opening this sandbox does not
   * have access to the sandbox.
   */
  get editorUrl(): string {
    return `https://codesandbox.io/p/devbox/${this.id}`;
  }

  // TODO: Bring this back once metrics polling does not reset inactivity
  // /**
  //  * Get the current system metrics. This return type may change in the future.
  //  */
  // public async getMetrics(): Promise<SystemMetricsStatus> {
  //   await this.pitcherClient.clients.system.update();

  //   const barrier = new Barrier<_protocol.system.SystemMetricsStatus>();
  //   const initialMetrics = this.pitcherClient.clients.system.getMetrics();
  //   if (!initialMetrics) {
  //     const disposable = this.pitcherClient.clients.system.onMetricsUpdated(
  //       (metrics) => {
  //         if (metrics) {
  //           barrier.open(metrics);
  //         }
  //       }
  //     );
  //     disposable.dispose();
  //   } else {
  //     barrier.open(initialMetrics);
  //   }

  //   const barrierResult = await barrier.wait();
  //   if (barrierResult.status === "disposed") {
  //     throw new Error("Metrics not available");
  //   }

  //   const metrics = barrierResult.value;

  //   return {
  //     cpu: {
  //       cores: metrics.cpu.cores,
  //       used: metrics.cpu.used / 100,
  //       configured: metrics.cpu.configured,
  //     },
  //     memory: {
  //       usedKiB: metrics.memory.used * 1024 * 1024,
  //       totalKiB: metrics.memory.total * 1024 * 1024,
  //       configuredKiB: metrics.memory.total * 1024 * 1024,
  //     },
  //     storage: {
  //       usedKB: metrics.storage.used * 1000 * 1000,
  //       totalKB: metrics.storage.total * 1000 * 1000,
  //       configuredKB: metrics.storage.configured * 1000 * 1000,
  //     },
  //   };
  // }

  /**
   * Disconnect from the sandbox, this does not hibernate the sandbox (it will
   * automatically hibernate after hibernation timeout). Call "reconnect" to
   * reconnect to the sandbox.
   */
  public disconnect() {
    return this.pitcherClient.disconnect();
  }

  /**
   * Explicitly reconnect to the sandbox.
   */
  public reconnect() {
    return this.pitcherClient.reconnect();
  }

  private keepAliveInterval: NodeJS.Timeout | null = null;
  /**
   * If enabled, we will keep the sandbox from hibernating as long as the SDK is connected to it.
   */
  public keepActiveWhileConnected(enabled: boolean) {
    if (enabled && !this.keepAliveInterval) {
      this.keepAliveInterval = setInterval(() => {
        this.pitcherClient.clients.system.update();
      }, 1000 * 30);

      this.disposable.onWillDispose(() => {
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
      });
    } else {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
    }
  }
  /**
   * Dispose the session, this will disconnect from the sandbox and dispose all resources. If you want to do a clean disconnect, await "disconnect" method first.
   */
  dispose() {
    this.disposable.dispose();
  }
}
