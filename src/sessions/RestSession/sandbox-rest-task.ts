import { Client } from "@hey-api/client-fetch";
import * as task from "../../clients/client-rest-task";

export class SandboxRestTask {
  constructor(private client: Client) {}

  list(body: task.TaskListData["body"] = {}) {
    return task.taskList({ client: this.client, body });
  }

  run(body: task.TaskRunData["body"]) {
    return task.taskRun({ client: this.client, body });
  }

  runCommand(body: task.TaskRunCommandData["body"]) {
    return task.taskRunCommand({ client: this.client, body });
  }

  stop(body: task.TaskStopData["body"]) {
    return task.taskStop({ client: this.client, body });
  }

  create(body: task.TaskCreateData["body"]) {
    return task.taskCreate({ client: this.client, body });
  }

  update(body: task.TaskUpdateData["body"]) {
    return task.taskUpdate({ client: this.client, body });
  }

  saveToConfig(body: task.TaskSaveToConfigData["body"]) {
    return task.taskSaveToConfig({ client: this.client, body });
  }

  generateConfig(body: task.TaskGenerateConfigData["body"] = {}) {
    return task.taskGenerateConfig({ client: this.client, body });
  }

  createSetupTasks(body: task.TaskCreateSetupTasksData["body"]) {
    return task.taskCreateSetupTasks({ client: this.client, body });
  }
}
