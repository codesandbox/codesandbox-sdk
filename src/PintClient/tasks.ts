import {
  IAgentClientTasks,
  IAgentClientSetup,
} from "../agent-client-interface";
import { Client } from "../api-clients/pint/client";
import {
  listTasks,
  getTask as getTaskAPI,
  executeTaskAction,
  listSetupTasks,
} from "../api-clients/pint";
import { task, setup } from "../pitcher-protocol";
import { Emitter } from "../utils/event";
export class PintClientTasks implements IAgentClientTasks {
  private onTaskUpdateEmitter = new Emitter<task.TaskDTO>();
  onTaskUpdate = this.onTaskUpdateEmitter.event;

  constructor(private apiClient: Client) {}

  async getTasks(): Promise<task.TaskListDTO> {
    try {
      const response = await listTasks({
        client: this.apiClient,
      });

      if (response.data) {
        // Convert API response to TaskListDTO format
        const tasks: Record<string, task.TaskDTO> = {};

        response.data.tasks.forEach((apiTask) => {
          tasks[apiTask.id] = {
            id: apiTask.id,
            name: apiTask.config.name,
            command: apiTask.config.command,
            runAtStart: apiTask.config.runAtStart,
            preview: {
              port: apiTask.config.preview?.port,
            },
            shell: null, // TODO: Map exec to shell if needed
            ports: [], // TODO: Map ports if available
          };
        });

        return {
          tasks,
          setupTasks: [], // TODO: Add setup tasks if needed
          validationErrors: [],
        };
      } else {
        throw new Error(response.error?.message || "Failed to fetch tasks");
      }
    } catch (error) {
      console.error("Failed to get tasks:", error);
      return {
        tasks: {},
        setupTasks: [],
        validationErrors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  async getTask(taskId: string): Promise<task.TaskDTO | undefined> {
    try {
      const response = await getTaskAPI({
        client: this.apiClient,
        path: { id: taskId },
      });

      if (response.data) {
        const apiTask = response.data.task;
        return {
          id: apiTask.id,
          name: apiTask.config.name,
          command: apiTask.config.command,
          runAtStart: apiTask.config.runAtStart,
          preview: {
            port: apiTask.config.preview?.port,
          },
          shell: null, // TODO: Map exec to shell if needed
          ports: [], // TODO: Map ports if available
        };
      } else {
        return undefined;
      }
    } catch (error) {
      console.error("Failed to get task:", error);
      return undefined;
    }
  }

  async runTask(taskId: string): Promise<task.TaskDTO> {
    try {
      const response = await executeTaskAction({
        client: this.apiClient,
        path: { id: taskId },
        query: { actionType: "start" },
      });

      if (response.data) {
        const taskDTO: task.TaskDTO = {
          id: response.data.id,
          name: response.data.name,
          command: response.data.command,
          runAtStart: false, // API doesn't provide this in action response
          shell: null, // TODO: Map exec to shell if needed
          ports: [], // TODO: Map ports if available
        };

        // Emit task update event
        this.onTaskUpdateEmitter.fire(taskDTO);

        return taskDTO;
      } else {
        throw new Error(response.error?.message || "Failed to run task");
      }
    } catch (error) {
      console.error("Failed to run task:", error);
      throw error;
    }
  }

  async stopTask(taskId: string): Promise<task.TaskDTO | null> {
    try {
      const response = await executeTaskAction({
        client: this.apiClient,
        path: { id: taskId },
        query: { actionType: "stop" },
      });

      if (response.data) {
        const taskDTO: task.TaskDTO = {
          id: response.data.id,
          name: response.data.name,
          command: response.data.command,
          runAtStart: false, // API doesn't provide this in action response
          shell: null, // TODO: Map exec to shell if needed
          ports: [], // TODO: Map ports if available
        };

        // Emit task update event
        this.onTaskUpdateEmitter.fire(taskDTO);

        return taskDTO;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Failed to stop task:", error);
      return null;
    }
  }
}

export class PintClientSetup implements IAgentClientSetup {
  private onSetupProgressUpdateEmitter = new Emitter<setup.SetupProgress>();
  onSetupProgressUpdate = this.onSetupProgressUpdateEmitter.event;

  constructor(private apiClient: Client) {}

  async getProgress(): Promise<setup.SetupProgress> {
    try {
      // Get setup tasks from the API
      const response = await listSetupTasks({
        client: this.apiClient,
      });

      if (response.data) {
        // Convert API setup tasks to setup progress format
        const steps: setup.Step[] = response.data.setupTasks.map((setupTask) => ({
          name: setupTask.name,
          command: setupTask.command,
          shellId: setupTask.execId || null,
          finishStatus: setupTask.status === 'FINISHED' ? 'SUCCEEDED' : 
                       setupTask.status === 'ERROR' ? 'FAILED' : null,
        }));

        // Determine overall state based on task statuses
        let state: setup.SetupProgress['state'] = 'IDLE';
        let currentStepIndex = 0;

        const hasRunningTask = response.data.setupTasks.some(task => task.status === 'RUNNING');
        const allFinished = response.data.setupTasks.every(task => 
          task.status === 'FINISHED' || task.status === 'ERROR');

        if (hasRunningTask) {
          state = 'IN_PROGRESS';
          // Find the first running task
          currentStepIndex = response.data.setupTasks.findIndex(task => task.status === 'RUNNING');
        } else if (allFinished) {
          state = 'FINISHED';
          currentStepIndex = steps.length - 1;
        }

        return {
          state,
          steps,
          currentStepIndex: Math.max(0, currentStepIndex),
        };
      } else {
        // Return empty setup progress if no data
        return {
          state: 'IDLE',
          steps: [],
          currentStepIndex: 0,
        };
      }
    } catch (error) {
      console.error("Failed to get setup progress:", error);
      return {
        state: 'IDLE',
        steps: [],
        currentStepIndex: 0,
      };
    }
  }

  async init(): Promise<setup.SetupProgress> {
    const progress = await this.getProgress();

    // Emit progress update event
    this.onSetupProgressUpdateEmitter.fire(progress);

    return progress;
  }
}