import { ProtocolError, TMessage, TNotification } from "../protocol";
import { shell, port as portProtocol } from "..";
import { PitcherErrorCode } from "../errors";

export type CommonError = ProtocolError;

export type TaskDefinitionDTO = {
  name: string;
  command: string;
  runAtStart?: boolean;
  preview?: {
    port?: number;
    "pr-link"?: "direct" | "redirect" | "devtool";
  };
};

export type TaskDTO = TaskDefinitionDTO & {
  id: string;
  unconfigured?: boolean;
  shell: null | shell.CommandShellDTO;
  ports: portProtocol.Port[];
};

export type TaskListDTO = {
  tasks: Record<string, TaskDTO>;
  setupTasks: TaskDefinitionDTO[];
  validationErrors: string[];
};

/* TODO: Use this later when the client has a UI on top of the config file */
export type TaskConfigDTO = {
  tasks: Record<string, TaskDefinitionDTO>;
  setupTasks: TaskDefinitionDTO[];
  validationErrors: string[];
};

export type TaskError =
  | {
      code: PitcherErrorCode.CONFIG_FILE_ALREADY_EXISTS;
      message: string;
    }
  | {
      code: PitcherErrorCode.TASK_NOT_FOUND;
      message: string;
    }
  | {
      code: PitcherErrorCode.COMMAND_ALREADY_CONFIGURED;
      message: string;
    }
  | ProtocolError;

export type TaskList = TMessage<
  "task/list",
  Record<string, never>,
  {
    result: TaskListDTO;
    error: CommonError;
  }
>;

export type TaskRun = TMessage<
  "task/run",
  {
    taskId: string;
  },
  {
    result: TaskDTO;
    error: TaskError;
  }
>;

export type TaskRunCommand = TMessage<
  "task/runCommand",
  {
    command: string;
    name?: string;
    saveToConfig?: boolean;
  },
  {
    result: TaskDTO;
    error: TaskError;
  }
>;

export type TaskStop = TMessage<
  "task/stop",
  {
    taskId: string;
  },
  {
    // null in case it's an unconfigured task, as it means all references are removed
    result: TaskDTO | null;
    error: TaskError;
  }
>;

export type TaskCreate = TMessage<
  "task/create",
  {
    taskFields: TaskDefinitionDTO;
    startTask?: boolean;
  },
  {
    // Return the entire list to ensure the list is in sync with all clients
    result: TaskListDTO;
    error: TaskError;
  }
>;

export type TaskUpdate = TMessage<
  "task/update",
  {
    taskId: string;
    taskFields: Partial<TaskDefinitionDTO>;
  },
  {
    result: TaskDTO;
    error: TaskError;
  }
>;

export type TaskSaveToConfig = TMessage<
  "task/saveToConfig",
  {
    taskId: string;
  },
  {
    result: TaskDTO;
    error: TaskError;
  }
>;

export type TaskGenerateConfig = TMessage<
  "task/generateConfig",
  Record<string, never>,
  {
    result: null;
    error: TaskError;
  }
>;

export type CreateSetupTasks = TMessage<
  "task/createSetupTasks",
  { tasks: TaskDefinitionDTO[] },
  {
    result: null;
    error: TaskError;
  }
>;

export type TasksMessage =
  | TaskList
  | TaskRun
  | TaskStop
  | TaskSaveToConfig
  | TaskRunCommand
  | TaskCreate
  | TaskUpdate
  | TaskGenerateConfig
  | CreateSetupTasks;

export type TaskRequest = TasksMessage["request"];

export type TaskResponse = TasksMessage["response"];

export type TaskListUpdated = TNotification<"task/listUpdate", TaskListDTO>;

export type TaskUpdated = TNotification<"task/update", TaskDTO>;

export type UnassignedPortOpened = TNotification<
  "task/unassignedPortOpened",
  portProtocol.Port
>;
export type UnassignedPortClosed = TNotification<
  "task/unassignedPortClosed",
  portProtocol.Port
>;

export type TaskConfigParseError = TNotification<
  "task/configParseError",
  {
    error: string;
  }
>;

export type TaskNotification =
  | TaskListUpdated
  | TaskUpdated
  | TaskConfigParseError
  | UnassignedPortOpened
  | UnassignedPortClosed;
