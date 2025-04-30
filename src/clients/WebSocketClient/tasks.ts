import type { IPitcherClient, protocol } from "@codesandbox/pitcher-client";

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

export class Tasks extends Disposable {
  constructor(private pitcherClient: IPitcherClient) {
    super();
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
