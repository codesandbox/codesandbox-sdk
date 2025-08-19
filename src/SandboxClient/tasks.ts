import * as protocol from "../pitcher-protocol";
import { Disposable, IDisposable } from "../utils/disposable";
import { DEFAULT_SHELL_SIZE } from "./terminals";
import { IAgentClient } from "../AgentClient/agent-client-interface";
import { Emitter } from "../utils/event";
import { Tracer, SpanStatusCode } from "@opentelemetry/api";

export type TaskDefinition = {
  name: string;
  command: string;
  runAtStart?: boolean;
};

export class Tasks {
  private disposable = new Disposable();
  private cachedTasks?: Task[];
  private tracer?: Tracer;

  constructor(
    sessionDisposable: Disposable,
    private agentClient: IAgentClient,
    tracer?: Tracer
  ) {
    this.tracer = tracer;
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  private async withSpan<T>(
    operationName: string,
    attributes: Record<string, string | number | boolean> = {},
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.tracer) {
      return operation();
    }

    return this.tracer.startActiveSpan(
      operationName,
      { attributes },
      async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Gets all tasks that are available in the current sandbox.
   */
  async getAll(): Promise<Task[]> {
    return this.withSpan(
      "tasks.getAll",
      { cached: !!this.cachedTasks },
      async () => {
        if (!this.cachedTasks) {
          const [tasks, ports] = await Promise.all([
            this.agentClient.tasks.getTasks(),
            this.agentClient.ports.getPorts(),
          ]);

          this.cachedTasks = Object.values(tasks.tasks).map(
            (task) => new Task(this.agentClient, task, ports, this.tracer)
          );
        }

        return this.cachedTasks;
      }
    );
  }

  /**
   * Gets a task by its ID.
   */
  async get(taskId: string): Promise<Task | undefined> {
    return this.withSpan("tasks.get", { taskId }, async () => {
      const tasks = await this.getAll();

      return tasks.find((task) => task.id === taskId);
    });
  }
}

export class Task {
  private disposable = new Disposable();
  private tracer?: Tracer;
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
    const configuredPort = this.data.preview?.port;

    // If we have configured a specific port, we only return that port. This is used where
    // the environment is not able to assign port automatically (e.g. Next JS)
    if (configuredPort) {
      return this._ports.filter((port) => port.port === configuredPort);
    }

    // Otherwise, we return the ports assigned to the task
    return this.data.ports;
  }
  get status() {
    return this.shell?.status || "IDLE";
  }
  constructor(
    private agentClient: IAgentClient,
    private data: protocol.task.TaskDTO,
    private _ports: protocol.port.Port[],
    tracer?: Tracer
  ) {
    this.tracer = tracer;
    this.disposable.addDisposable(
      agentClient.ports.onPortsUpdated((ports) => {
        this._ports = ports;
      })
    );
    this.disposable.addDisposable(
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
      })
    );

    this.disposable.addDisposable(
      this.agentClient.shells.onShellOut(({ shellId, out }) => {
        if (
          !this.shell ||
          this.shell.shellId !== shellId ||
          !this.openedShell
        ) {
          return;
        }

        // Update output for shell
        this.openedShell.output.push(out);
        this.onOutputEmitter.fire(out);
      })
    );
  }

  private async withSpan<T>(
    operationName: string,
    attributes: Record<string, string | number | boolean> = {},
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.tracer) {
      return operation();
    }

    return this.tracer.startActiveSpan(
      operationName,
      { attributes },
      async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  async open(dimensions = DEFAULT_SHELL_SIZE) {
    return this.withSpan(
      "task.open",
      {
        taskId: this.id,
        taskName: this.name,
        cols: dimensions.cols,
        rows: dimensions.rows,
        hasShell: !!this.shell,
      },
      async () => {
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
    );
  }
  async waitForPort(timeout: number = 30_000) {
    return this.withSpan(
      "task.waitForPort",
      {
        taskId: this.id,
        taskName: this.name,
        timeout,
        existingPortsCount: this.ports.length,
      },
      async () => {
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
            this.disposable.addDisposable(disposer);
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
    );
  }
  async run() {
    return this.withSpan(
      "task.run",
      {
        taskId: this.id,
        taskName: this.name,
        command: this.command,
        runAtStart: this.runAtStart,
      },
      async () => {
        await this.agentClient.tasks.runTask(this.id);
      }
    );
  }
  async restart() {
    return this.withSpan(
      "task.restart",
      {
        taskId: this.id,
        taskName: this.name,
        command: this.command,
      },
      async () => {
        await this.run();
      }
    );
  }
  async stop() {
    return this.withSpan(
      "task.stop",
      {
        taskId: this.id,
        taskName: this.name,
        hasShell: !!this.shell,
      },
      async () => {
        if (this.shell) {
          await this.agentClient.tasks.stopTask(this.id);
        }
      }
    );
  }
  dispose() {
    this.disposable.dispose();
  }
}
