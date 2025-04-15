import { Client } from "@hey-api/client-fetch";
import * as task from "../clients/client-rest-task";
import { SessionData } from "../sessions";
import { getSessionUrl } from "../utils/session";

export class SandboxRestTask {
  constructor(private client: Client) {}

  private createRestParams<T>(session: SessionData, body: T) {
    return {
      baseUrl: getSessionUrl(session),
      client: this.client,
      body,
      throwOnError: true,
    };
  }

  list(session: SessionData, body: task.TaskListData["body"] = {}) {
    return task.taskList(this.createRestParams(session, body));
  }

  run(session: SessionData, body: task.TaskRunData["body"]) {
    return task.taskRun(this.createRestParams(session, body));
  }

  runCommand(session: SessionData, body: task.TaskRunCommandData["body"]) {
    return task.taskRunCommand(this.createRestParams(session, body));
  }

  stop(session: SessionData, body: task.TaskStopData["body"]) {
    return task.taskStop(this.createRestParams(session, body));
  }

  create(session: SessionData, body: task.TaskCreateData["body"]) {
    return task.taskCreate(this.createRestParams(session, body));
  }

  update(session: SessionData, body: task.TaskUpdateData["body"]) {
    return task.taskUpdate(this.createRestParams(session, body));
  }

  saveToConfig(session: SessionData, body: task.TaskSaveToConfigData["body"]) {
    return task.taskSaveToConfig(this.createRestParams(session, body));
  }

  generateConfig(
    session: SessionData,
    body: task.TaskGenerateConfigData["body"] = {}
  ) {
    return task.taskGenerateConfig(this.createRestParams(session, body));
  }

  createSetupTasks(
    session: SessionData,
    body: task.TaskCreateSetupTasksData["body"]
  ) {
    return task.taskCreateSetupTasks(this.createRestParams(session, body));
  }
}
