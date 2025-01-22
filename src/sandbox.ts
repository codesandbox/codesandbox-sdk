import {
  Barrier,
  Disposable,
  type IPitcherClient,
  type protocol as _protocol,
} from "@codesandbox/pitcher-client";

import { FileSystem } from "./filesystem";
import { Ports } from "./ports";
import { Setup } from "./setup";
import { Shells } from "./shells";
import { Tasks } from "./tasks";

import type { SandboxClient, VMTier } from ".";
import { Sessions } from "./sessions";
export { SessionConnectInfo } from "./sessions";

export {
  FSStatResult,
  WriteFileOpts,
  ReaddirEntry,
  WatchOpts,
  WatchEvent,
  Watcher,
} from "./filesystem";

export { PortInfo } from "./ports";

export { SetupProgress, Step, SetupShellStatus } from "./setup";

export {
  RunningCommand,
  ShellSize,
  ShellStatus,
  ShellCreateOpts,
  ShellRunOpts,
  ShellOpenOpts,
} from "./shells";

export { Task, TaskDefinition } from "./tasks";

export interface SystemMetricsStatus {
  cpu: {
    cores: number;
    used: number;
    configured: number;
  };
  memory: {
    usedKiB: number;
    totalKiB: number;
    configuredKiB: number;
  };
  storage: {
    usedKB: number;
    totalKB: number;
    configuredKB: number;
  };
}

export class SandboxSession extends Disposable {
  /**
   * Namespace for all filesystem operations on this sandbox.
   */
  public readonly fs = this.addDisposable(new FileSystem(this.pitcherClient));

  /**
   * Namespace for running shell commands on this sandbox.
   */
  public readonly shells = this.addDisposable(new Shells(this.pitcherClient));

  /**
   * Namespace for detecting open ports on this sandbox, and getting preview URLs for
   * them.
   */
  public readonly ports = this.addDisposable(new Ports(this.pitcherClient));

  /**
   * Namespace for all setup operations on this sandbox (installing dependencies, etc).
   *
   * This provider is *experimental*, it might get changes or completely be removed
   * if it is not used.
   */
  public readonly setup = this.addDisposable(new Setup(this.pitcherClient));

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
  public readonly tasks = this.addDisposable(new Tasks(this.pitcherClient));

  constructor(protected pitcherClient: IPitcherClient) {
    super();

    // TODO: Bring this back once metrics polling does not reset inactivity
    // const metricsDisposable = {
    //   dispose:
    //     this.pitcherClient.clients.system.startMetricsPollingAtInterval(5000),
    // };

    // this.addDisposable(metricsDisposable);
    this.addDisposable(this.pitcherClient);
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
    this.pitcherClient.disconnect();
    this.dispose();
  }
}

export class Sandbox extends SandboxSession {
  public readonly sessions = this.addDisposable(
    new Sessions(this.id, this.sandboxClient)
  );

  constructor(
    private sandboxClient: SandboxClient,
    pitcherClient: IPitcherClient
  ) {
    super(pitcherClient);
  }

  /**
   * This creates a copy of the current sandbox, both memory and disk is copied, which means
   * that running processes will continue to run in the forked sandbox.
   */
  public async fork(): Promise<Sandbox> {
    return this.sandboxClient.create({
      template: this.id,
    });
  }

  /**
   * Hibernate the sandbox. This will snapshot the disk and memory of the sandbox, so it
   * can be restored later from the exact current state. Will resolve once the sandbox is hibernated.
   */
  public async hibernate(): Promise<void> {
    this.dispose();
    this.pitcherClient.disconnect();

    await this.sandboxClient.hibernate(this.id);
  }

  /**
   * Shutdown the sandbox. This will stop all running processes and stop the sandbox. When you
   * start the sandbox next time, you will still have the same files and state as when you
   * shut down the sandbox.
   *
   * Will resolve once the sandbox is shutdown.
   */
  public async shutdown(): Promise<void> {
    this.dispose();
    this.pitcherClient.disconnect();

    await this.sandboxClient.shutdown(this.id);
  }

  /**
   * Reboot the sandbox. This will shutdown the sandbox, and then start it again. Files in
   * the project directory (`/project/sandbox`) will be preserved.
   *
   * Will resolve once the sandbox is rebooted.
   */
  public async reboot(): Promise<void> {
    await this.shutdown();
    const newSandbox = await this.sandboxClient.open(this.id);
    Object.assign(this, newSandbox);
  }

  /**
   * Updates the specs that this sandbox runs on. It will dynamically scale the sandbox to the
   * new specs without a reboot. Be careful when scaling specs down, if the VM is using more memory
   * than it can scale down to, it can become very slow.
   */
  public async updateTier(tier: VMTier): Promise<void> {
    await this.sandboxClient.updateTier(this.id, tier);
  }

  /**
   * Updates the hibernation timeout of a sandbox.
   *
   * @param timeoutSeconds The new hibernation timeout in seconds
   */
  public async updateHibernationTimeout(timeoutSeconds: number): Promise<void> {
    await this.sandboxClient.updateHibernationTimeout(this.id, timeoutSeconds);
  }
}
