import * as protocol from "@codesandbox/pitcher-protocol";
import { Disposable, IDisposable } from "../utils/disposable";
import { DEFAULT_SHELL_SIZE } from "./terminals";
import { IAgentClient } from "../agent-client-interface";
import { Emitter } from "../utils/event";

export type TaskDefinition = {
  name: string;
  command: string;
  runAtStart?: boolean;
};

export class Tasks {
  private disposable = new Disposable();
  private cachedTasks?: Task[];
  constructor(
    sessionDisposable: Disposable,
    private agentClient: IAgentClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  /**
   * Gets all tasks that are available in the current sandbox.
   */
  async getAll(): Promise<Task[]> {
    if (!this.cachedTasks) {
      const tasks = await this.agentClient.tasks.getTasks();

      this.cachedTasks = Object.values(tasks.tasks).map(
        (task) => new Task(this.agentClient, task)
      );
    }

    return this.cachedTasks;
  }

  /**
   * Gets a task by its ID.
   */
  async get(taskId: string): Promise<Task | undefined> {
    const tasks = await this.getAll();

    return tasks.find((task) => task.id === taskId);
  }
}

export class Task {
  private disposable = new Disposable();
  private get shell() {
    return this.data.shell;
  }
  private openedShell?: {
    shellId: string;
    output: string[];
    dimensions: typeof DEFAULT_SHELL_SIZE;
  };
  private onOutputEmitter = this.disposable.addDisposable(
    new Emitter<string>()
  );
  public readonly onOutput = this.onOutputEmitter.event;
  private onStatusChangeEmitter = this.disposable.addDisposable(
    new Emitter<protocol.shell.ShellProcessStatus | "IDLE">()
  );
  public readonly onStatusChange = this.onStatusChangeEmitter.event;
  get id() {
    return this.data.id;
  }
  get name() {
    return this.data.name;
  }
  get command() {
    return this.data.command;
  }
  get runAtStart() {
    return Boolean(this.data.runAtStart);
  }
  get ports() {
    return this.data.ports;
  }
  get status() {
    return this.shell?.status || "IDLE";
  }
  constructor(
    private agentClient: IAgentClient,
    private data: protocol.task.TaskDTO
  ) {
    agentClient.tasks.onTaskUpdate(async (task) => {
      if (task.id !== this.id) {
        return;
      }

      const lastStatus = this.status;
      const lastShellId = this.shell?.shellId;

      this.data = task;

      if (lastStatus !== this.status) {
        this.onStatusChangeEmitter.fire(this.status);
      }

      if (
        this.openedShell &&
        task.shell &&
        task.shell.shellId !== lastShellId
      ) {
        const openedShell = await this.agentClient.shells.open(
          task.shell.shellId,
          this.openedShell.dimensions
        );

        this.openedShell = {
          shellId: openedShell.shellId,
          output: openedShell.buffer,
          dimensions: this.openedShell.dimensions,
        };

        this.onOutputEmitter.fire("\x1B[2J\x1B[3J\x1B[1;1H");
        openedShell.buffer.forEach((out) => this.onOutputEmitter.fire(out));
      }
    });

    this.agentClient.shells.onShellOut(({ shellId, out }) => {
      if (!this.shell || this.shell.shellId !== shellId || !this.openedShell) {
        return;
      }

      // Update output for shell
      this.openedShell.output.push(out);
      this.onOutputEmitter.fire(out);
    });
  }
  async open(dimensions = DEFAULT_SHELL_SIZE) {
    if (!this.shell) {
      throw new Error("Task is not running");
    }

    const openedShell = await this.agentClient.shells.open(
      this.shell.shellId,
      dimensions
    );

    this.openedShell = {
      shellId: openedShell.shellId,
      output: openedShell.buffer,
      dimensions,
    };

    return this.openedShell.output.join("\n");
  }
  async waitForPort(timeout: number = 30_000) {
    if (this.ports.length) {
      return this.ports[0];
    }

    let disposer: IDisposable | undefined;

    const [port] = await Promise.all([
      new Promise<protocol.port.Port>((resolve) => {
        disposer = this.agentClient.tasks.onTaskUpdate((task) => {
          if (task.id !== this.id) {
            return;
          }

          if (task.ports.length) {
            disposer?.dispose();
            resolve(task.ports[0]);
          }
        });
      }),
      new Promise<protocol.port.Port>((resolve, reject) => {
        setTimeout(() => {
          disposer?.dispose();
          reject(new Error("Timeout waiting for port"));
        }, timeout);
      }),
    ]);

    return port;
  }
  async run() {
    await this.agentClient.tasks.runTask(this.id);
  }
  async restart() {
    await this.run();
  }
  async stop() {
    if (this.shell) {
      await this.agentClient.tasks.stopTask(this.id);
    }
  }
}
