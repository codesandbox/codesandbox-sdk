import {
  Emitter,
  IDisposable,
  type IPitcherClient,
  type protocol,
} from "@codesandbox/pitcher-client";

import { Disposable } from "../../utils/disposable";

export type TaskDefinition = {
  name: string;
  command: string;
  runAtStart?: boolean;
  preview?: {
    port?: number;
    "pr-link"?: "direct" | "redirect" | "devtool";
  };
};

export type Task = TaskDefinition & {
  id: string;
  unconfigured?: boolean;
  shellId: null | string;
  ports: protocol.port.Port[];
};

type TaskShellSubscription = {
  shellId: string;
  disposable: IDisposable;
};

export class Tasks {
  private disposable = new Disposable();
  private shellOutputListeners: Record<string, TaskShellSubscription> = {};
  private onTaskOutputEmitter = this.disposable.addDisposable(
    new Emitter<{
      taskId: string;
      output: string;
    }>()
  );
  public readonly onTaskOutput = this.onTaskOutputEmitter.event;

  constructor(
    sessionDisposable: Disposable,
    private pitcherClient: IPitcherClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
    this.disposable.addDisposable(
      pitcherClient.clients.task.onTaskUpdate((task) =>
        this.listenToShellOutput(task)
      )
    );
    this.disposable.onWillDispose(() => {
      Object.values(this.shellOutputListeners).forEach((listener) =>
        listener.disposable.dispose()
      );
    });
  }

  private async listenToShellOutput(task: protocol.task.TaskDTO) {
    const existingListener = this.shellOutputListeners[task.id];

    // Already have shell registered
    if (existingListener && task.shell?.shellId === existingListener.shellId) {
      return;
    }

    // Has removed shell
    if (
      existingListener &&
      (!task.shell || task.shell.shellId !== existingListener.shellId)
    ) {
      existingListener.disposable.dispose();
    }

    // No new shell
    if (!task.shell) {
      return;
    }

    // Has new shell
    const taskShellId = task.shell.shellId;
    let listener: TaskShellSubscription = {
      shellId: taskShellId,
      disposable: this.pitcherClient.clients.shell.onShellOut(
        ({ shellId, out }) => {
          if (shellId === taskShellId) {
            this.onTaskOutputEmitter.fire({
              taskId: task.id,
              output: out,
            });
          }
        }
      ),
    };

    this.shellOutputListeners[task.id] = listener;

    this.pitcherClient.clients.shell.open(task.shell.shellId, {
      cols: 80,
      rows: 24,
    });

    /*
    this.onTaskOutputEmitter.fire({
      taskId: task.id,
      output: shell.buffer.join("\n"),
    });
    */
  }

  /**
   * Gets all tasks that are available in the current sandbox.
   */
  async getTasks(): Promise<Task[]> {
    const tasks = await this.pitcherClient.clients.task.getTasks();

    return Object.values(tasks.tasks).map(taskFromDTO);
  }

  /**
   * Gets a task by its ID.
   */
  async getTask(taskId: string): Promise<Task | undefined> {
    const task = await this.pitcherClient.clients.task.getTask(taskId);

    if (!task) {
      return undefined;
    }

    return taskFromDTO(task);
  }

  /**
   * Runs a task by its ID.
   */
  async runTask(taskId: string): Promise<Task> {
    const task = await this.pitcherClient.clients.task.runTask(taskId);

    return taskFromDTO(task);
  }

  async stopTask(taskId: string) {
    await this.pitcherClient.clients.task.stopTask(taskId);
  }
}

function taskFromDTO(value: protocol.task.TaskDTO): Task {
  return {
    id: value.id,
    name: value.name,
    command: value.command,
    runAtStart: value.runAtStart,
    preview: value.preview,
    shellId: value.shell?.shellId ?? null,
    ports: value.ports,
  };
}
