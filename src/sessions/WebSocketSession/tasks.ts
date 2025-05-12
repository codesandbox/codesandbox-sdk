import {
  Emitter,
  IDisposable,
  type IPitcherClient,
  type protocol,
} from "@codesandbox/pitcher-client";

import { Disposable } from "../../utils/disposable";
import { DEFAULT_SHELL_SIZE } from "./terminals";

export type TaskDefinition = {
  name: string;
  command: string;
  runAtStart?: boolean;
  preview?: {
    port?: number;
    "pr-link"?: "direct" | "redirect" | "devtool";
  };
};

export class Tasks {
  private disposable = new Disposable();
  private tasks: Task[] = [];
  constructor(
    sessionDisposable: Disposable,
    private pitcherClient: IPitcherClient
  ) {
    this.tasks = Object.values(
      this.pitcherClient.clients.task.getTasks().tasks
    ).map((task) => new Task(this.pitcherClient, task));

    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  /**
   * Gets all tasks that are available in the current sandbox.
   */
  getTasks(): Task[] {
    return this.tasks;
  }

  /**
   * Gets a task by its ID.
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.find((task) => task.id === taskId);
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
    return this.data.runAtStart;
  }
  get ports() {
    return this.data.ports;
  }
  get status() {
    return this.shell?.status || "IDLE";
  }
  constructor(
    private pitcherClient: IPitcherClient,
    private data: protocol.task.TaskDTO
  ) {
    pitcherClient.clients.task.onTaskUpdate(async (task) => {
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
        const openedShell = await this.pitcherClient.clients.shell.open(
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

    pitcherClient.clients.shell.onShellOut(({ shellId, out }) => {
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

    const openedShell = await this.pitcherClient.clients.shell.open(
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

    return Promise.all([
      new Promise<protocol.port.Port>((resolve) => {
        disposer = this.pitcherClient.clients.task.onTaskUpdate((task) => {
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
  }
  async run() {
    await this.pitcherClient.clients.task.runTask(this.id);
  }
  async restart() {
    await this.run();
  }
  async stop() {
    if (this.shell) {
      await this.pitcherClient.clients.task.stopTask(this.id);
    }
  }
}
