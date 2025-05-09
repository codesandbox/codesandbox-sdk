import { initPitcherClient } from "@codesandbox/pitcher-client";
import { Disposable } from "../../utils/disposable";
import {
  protocol as _protocol,
  type IPitcherClient,
} from "@codesandbox/pitcher-client";

import { FileSystem } from "./filesystem";
import { Ports } from "./ports";
import { Setup } from "./setup";
import { Shells } from "./shells";
import { Tasks } from "./tasks";
import { DEFAULT_SUBSCRIPTIONS, SandboxSession } from "../../types";
import { Client } from "@hey-api/client-fetch";
import { Interpreters } from "./interpreters";
import { Terminals } from "./terminals";
import { Commands } from "./commands";

export * from "./filesystem";
export * from "./ports";
export * from "./setup";
export * from "./shells";
export * from "./tasks";
export * from "./terminals";
export * from "./commands";
export * from "./interpreters";

export class WebSocketSession {
  private disposable = new Disposable();

  static async init(session: SandboxSession, apiClient: Client) {
    const pitcherClient = await initPitcherClient(
      {
        appId: "sdk",
        instanceId: session.sandboxId,
        onFocusChange() {
          return () => {};
        },
        requestPitcherInstance: async () => {
          const headers = apiClient.getConfig().headers as Headers;

          if (headers.get("x-pitcher-manager-url")) {
            // This is a hack, we need to tell the global scheduler that the VM is running
            // in a different cluster than the one it'd like to default to.

            const preferredManager = headers
              .get("x-pitcher-manager-url")
              ?.replace("/api/v1", "")
              .replace("https://", "");
            const baseUrl = apiClient
              .getConfig()
              .baseUrl?.replace("api", "global-scheduler");

            await fetch(
              `${baseUrl}/api/v1/cluster/${session.sandboxId}?preferredManager=${preferredManager}`
            ).then((res) => res.json());
          }

          return {
            bootupType: "RESUME",
            pitcherURL: session.pitcherUrl,
            workspacePath: session.userWorkspacePath,
            userWorkspacePath: session.userWorkspacePath,
            pitcherManagerVersion: "1.0.0-session",
            pitcherVersion: "1.0.0-session",
            latestPitcherVersion: "1.0.0-session",
            pitcherToken: session.pitcherToken,
            cluster: "session",
          };
        },
        subscriptions: DEFAULT_SUBSCRIPTIONS,
      },
      () => {}
    );

    return new WebSocketSession(pitcherClient);
  }
  /**
   * Namespace for all filesystem operations on this sandbox.
   */
  public readonly fs = new FileSystem(this.disposable, this.pitcherClient);

  /**
   * Namespace for running shell commands on this sandbox.
   */
  public readonly shells = new Shells(this.disposable, this.pitcherClient);

  public readonly terminals = new Terminals(
    this.disposable,
    this.pitcherClient
  );
  public readonly commands = new Commands(this.disposable, this.pitcherClient);

  public readonly interpreters = new Interpreters(
    this.disposable,
    this.pitcherClient,
    this.commands
  );

  /**
   * Namespace for detecting open ports on this sandbox, and getting preview URLs for
   * them.
   */
  public readonly ports = new Ports(this.disposable, this.pitcherClient);

  /**
   * Namespace for all setup operations on this sandbox (installing dependencies, etc).
   *
   * This provider is *experimental*, it might get changes or completely be removed
   * if it is not used.
   */
  public readonly setup = new Setup(this.disposable, this.pitcherClient);

  /**
   * Namespace for all task operations on a sandbox. This includes running tasks,
   * getting tasks, and stopping tasks.
   *
   * In CodeSandbox, you can create tasks and manage them by creating a `.codesandbox/tasks.json`
   * in the sandbox. These tasks become available under this namespace, this way you can manage
   * tasks that you will need to run more often (like a dev server).
   *
   * More documentation: https://codesandbox.io/docs/learn/devboxes/task#adding-and-configuring-tasks
   *
   * This provider is *experimental*, it might get changes or completely be removed
   * if it is not used.
   */
  public readonly tasks = new Tasks(this.disposable, this.pitcherClient);

  constructor(protected pitcherClient: IPitcherClient) {
    // TODO: Bring this back once metrics polling does not reset inactivity
    // const metricsDisposable = {
    //   dispose:
    //     this.pitcherClient.clients.system.startMetricsPollingAtInterval(5000),
    // };

    // this.addDisposable(metricsDisposable);
    this.disposable.addDisposable(this.pitcherClient);
  }

  // Not sure why we have to explicitly type this
  get state(): typeof this.pitcherClient.state {
    return this.pitcherClient.state;
  }

  get onStateChange() {
    return this.pitcherClient.onStateChange.bind(this.pitcherClient);
  }

  /**
   * Check if the VM agent process is up to date. To update a restart is required
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
   * Disconnect from the sandbox, this does not hibernate the sandbox (but it will
   * automatically hibernate after an inactivity timer).
   */
  public disconnect() {
    return this.pitcherClient.disconnect();
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
  dispose() {
    this.disposable.dispose();
  }
}
