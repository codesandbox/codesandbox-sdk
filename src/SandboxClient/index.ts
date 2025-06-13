import { Disposable } from "../utils/disposable";

import { FileSystem } from "./filesystem";
import { Ports } from "./ports";
import { Setup } from "./setup";
import { Tasks } from "./tasks";
import { Interpreters } from "./interpreters";
import { Terminals } from "./terminals";
import { Commands } from "./commands";
import { Git } from "./git";
import { HostToken } from "../HostTokens";
import { Hosts } from "./hosts";
import { IAgentClient } from "../node/agent-client-interface";
import { setup } from "../pitcher-protocol";
import { Barrier } from "../utils/barrier";

export * from "./filesystem";
export * from "./ports";
export * from "./setup";
export * from "./tasks";
export * from "./terminals";
export * from "./commands";
export * from "./git";
export * from "./interpreters";
export * from "./hosts";

type SandboxClientParams = {
  hostToken?: HostToken;
  username?: string;
};

export class SandboxClient {
  static async create(agentClient: IAgentClient, params: SandboxClientParams) {
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
    this.commands = new Commands(this.disposable, this.agentClient);

    this.hosts = new Hosts(this.agentClient.sandboxId, hostToken);
    this.interpreters = new Interpreters(this.disposable, this.commands);
    this.git = new Git(this.agentClient, this.commands);
    this.disposable.onWillDispose(() => this.agentClient.dispose());
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
    return this.agentClient.disconnect();
  }

  /**
   * Explicitly reconnect to the sandbox.
   */
  public reconnect() {
    return this.agentClient.reconnect();
  }

  private keepAliveInterval: NodeJS.Timeout | null = null;
  /**
   * If enabled, we will keep the sandbox from hibernating as long as the SDK is connected to it.
   */
  public keepActiveWhileConnected(enabled: boolean) {
    if (enabled && !this.keepAliveInterval) {
      this.keepAliveInterval = setInterval(() => {
        this.agentClient.system.update();
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
