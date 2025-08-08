import { Disposable } from "../utils/disposable";
import { retryWithDelay } from "../utils/api";

import { FileSystem } from "./filesystem";
import { Ports } from "./ports";
import { Setup } from "./setup";
import { Tasks } from "./tasks";
import { Interpreters } from "./interpreters";
import { Terminals } from "./terminals";
import { SandboxCommands } from "./commands";
import { HostToken } from "../HostTokens";
import { Hosts } from "./hosts";
import { IAgentClient } from "../AgentClient/agent-client-interface";
import { setup, system } from "../pitcher-protocol";
import { Barrier } from "../utils/barrier";
import { AgentClient } from "../AgentClient";
import { SandboxSession } from "../types";

export * from "./filesystem";
export * from "./ports";
export * from "./setup";
export * from "./tasks";
export * from "./terminals";
export * from "./commands";
export * from "./interpreters";
export * from "./hosts";

type SandboxClientParams = {
  hostToken?: HostToken;
  username?: string;
};

export class SandboxClient {
  static async create(
    session: SandboxSession,
    getSession: (id: string) => Promise<SandboxSession>,
    initStatusCb?: (event: system.InitStatus) => void
  ) {
    const { client: agentClient, joinResult } = await AgentClient.create({
      session,
      getSession,
    });

    if (initStatusCb) {
      agentClient.system.onInitStatusUpdate(initStatusCb);
    }

    const params = {
      // On dedicated sessions we need the username to normalize
      // FS events
      username: session.sessionId ? joinResult.client.username : undefined,
      hostToken: session.hostToken,
    };

    let setupProgress = await agentClient.setup.getProgress();

    let hasInitializedSteps = Boolean(setupProgress.steps.length);

    if (hasInitializedSteps) {
      return new SandboxClient(agentClient, params, setupProgress);
    }

    // We have a race condition where we might not have the steps yet and need
    // an event to tell us when they have started. But we might also have all the steps,
    // where no new event will arrive. So we use a barrier to manage this
    const initialStepsBarrier = new Barrier<setup.SetupProgress>();

    const setupProgressUpdateDisposable =
      agentClient.setup.onSetupProgressUpdate((progress) => {
        setupProgressUpdateDisposable.dispose();
        initialStepsBarrier.open(progress);
      });

    const response = await initialStepsBarrier.wait();

    if (response.status === "disposed") {
      throw new Error("Failed to get setup progress");
    }

    return new SandboxClient(agentClient, params, response.value);
  }
  private disposable = new Disposable();

  get workspacePath() {
    return this.agentClient.workspacePath;
  }

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
  public readonly commands: SandboxCommands;

  /**
   * Namespace for running code interpreters in the Sandbox
   */
  public readonly interpreters: Interpreters;

  /**
   * Namespace for managing ports on this Sandbox
   */
  public readonly ports = new Ports(this.disposable, this.agentClient);

  /**
   * Namespace for the setup that runs when the Sandbox starts from scratch.
   */
  public readonly setup: Setup;

  /**
   * Namespace for tasks that are defined in the Sandbox.
   */
  public readonly tasks = new Tasks(this.disposable, this.agentClient);

  constructor(
    protected agentClient: IAgentClient,
    { hostToken, username }: SandboxClientParams,
    initialSetupProgress: setup.SetupProgress
  ) {
    // TODO: Bring this back once metrics polling does not reset inactivity
    // const metricsDisposable = {
    //   dispose:
    //     this.pitcherClient.clients.system.startMetricsPollingAtInterval(5000),
    // };

    // this.addDisposable(metricsDisposable);
    this.setup = new Setup(
      this.disposable,
      this.agentClient,
      initialSetupProgress
    );
    this.fs = new FileSystem(this.disposable, this.agentClient, username);
    this.terminals = new Terminals(this.disposable, this.agentClient);
    this.commands = new SandboxCommands(this.disposable, this.agentClient);

    this.hosts = new Hosts(this.agentClient.sandboxId, hostToken);
    this.interpreters = new Interpreters(this.disposable, this.commands);
    this.disposable.onWillDispose(() => this.agentClient.dispose());

    this.disposable.onWillDispose(() => {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
    });

    this.agentClient.onStateChange((state) => {
      if (state === "DISCONNECTED" || state === "HIBERNATED") {
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
        }
        this.keepAliveInterval = null;

        // Only attempt auto-reconnect on DISCONNECTED, not HIBERNATED
        if (state === "DISCONNECTED" && !this.isExplicitlyDisconnected) {
          this.attemptAutoReconnect();
        }
      } else if (state === "CONNECTED") {
        if (this.shouldKeepAlive) {
          this.keepActiveWhileConnected(true);
        }
      }
    });
  }

  /**
   * The current state of the Sandbox
   */
  get state(): typeof this.agentClient.state {
    return this.agentClient.state;
  }

  /**
   * An event that is emitted when the state of the Sandbox changes.
   */
  get onStateChange() {
    return this.agentClient.onStateChange.bind(this.agentClient);
  }

  /**
   * Check if the Sandbox Agent process is up to date. To update a restart is required
   */
  get isUpToDate() {
    return this.agentClient.isUpToDate;
  }

  /**
   * The ID of the sandbox.
   */
  get id(): string {
    return this.agentClient.sandboxId;
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
    this.isExplicitlyDisconnected = true;
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    return this.agentClient.disconnect();
  }

  /**
   * Explicitly reconnect to the sandbox.
   */
  public reconnect() {
    this.isExplicitlyDisconnected = false;
    return this.agentClient.reconnect();
  }

  /**
   * Attempt automatic reconnection with retry logic
   */
  private async attemptAutoReconnect() {
    try {
      await retryWithDelay(
        async () => {
          if (this.isExplicitlyDisconnected) {
            throw new Error("Explicit disconnect - stopping auto-reconnect");
          }
          await this.agentClient.reconnect();
        },
        3, // retries
        2000 // delay in ms
      );
      // Clear the disconnect flag on successful reconnection
      this.isExplicitlyDisconnected = false;
    } catch (error) {
      // Auto-reconnect failed, but we don't throw to avoid unhandled rejections
      console.warn("Auto-reconnect failed:", error);
    }
  }

  private keepAliveInterval: NodeJS.Timeout | null = null;
  private shouldKeepAlive = false;
  private isExplicitlyDisconnected = false;
  /**
   * If enabled, we will keep the sandbox from hibernating as long as the SDK is connected to it.
   */
  public keepActiveWhileConnected(enabled: boolean) {
    // Used to manage the interval when disconnects happen
    this.shouldKeepAlive = enabled;

    if (enabled) {
      if (!this.keepAliveInterval) {
        this.keepAliveInterval = setInterval(() => {
          this.agentClient.system.update().catch(() => {
            // We do not care about errors here
          });
        }, 1000 * 30);
      }
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
