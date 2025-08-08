import * as protocol from "../pitcher-protocol";
import { Disposable } from "../utils/disposable";
import { Emitter } from "../utils/event";
import { DEFAULT_SHELL_SIZE } from "./terminals";
import { IAgentClient } from "../AgentClient/agent-client-interface";
import { Tracer, SpanStatusCode } from "@opentelemetry/api";

export class Setup {
  private disposable = new Disposable();
  private steps: Step[];
  private readonly onSetupProgressChangeEmitter = this.disposable.addDisposable(
    new Emitter<void>()
  );
  public readonly onSetupProgressChange =
    this.onSetupProgressChangeEmitter.event;
  get status() {
    return this.setupProgress.state;
  }
  get currentStepIndex() {
    return this.setupProgress.currentStepIndex;
  }
  constructor(
    sessionDisposable: Disposable,
    private agentClient: IAgentClient,
    private setupProgress: protocol.setup.SetupProgress,
    private tracer?: Tracer
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
    this.steps = this.setupProgress.steps.map(
      (step, index) => new Step(index, step, agentClient, tracer)
    );
  }

  private withSpan<T>(
    operationName: string,
    attributes: Record<string, any>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.tracer) {
      return fn();
    }
    return this.tracer.startActiveSpan(operationName, { attributes }, async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    });
  }

  getSteps() {
    return this.steps;
  }

  async run(): Promise<void> {
    return this.withSpan(
      "setup.run",
      {
        "setup.state": this.setupProgress.state,
        "setup.currentStepIndex": this.setupProgress.currentStepIndex,
        "setup.totalSteps": this.setupProgress.steps.length,
      },
      async () => {
        await this.agentClient.setup.init();
      }
    );
  }

  async waitUntilComplete(): Promise<void> {
    return this.withSpan(
      "setup.waitUntilComplete",
      {
        "setup.state": this.setupProgress.state,
        "setup.currentStepIndex": this.setupProgress.currentStepIndex,
        "setup.totalSteps": this.setupProgress.steps.length,
      },
      async () => {
        if (this.setupProgress.state === "STOPPED") {
          throw new Error("Setup Failed");
        }

        if (this.setupProgress.state === "FINISHED") {
          return;
        }

        return new Promise<void>((resolve, reject) => {
          const disposer = this.onSetupProgressChange(() => {
            if (this.setupProgress.state === "FINISHED") {
              disposer.dispose();
              resolve();
            } else if (this.setupProgress.state === "STOPPED") {
              disposer.dispose();
              reject(new Error("Setup Failed"));
            }
          });
        });
      }
    );
  }
}

export class Step {
  private disposable = new Disposable();
  // TODO: differentiate between stdout and stderr, also send back bytes instead of
  // strings
  private onOutputEmitter = this.disposable.addDisposable(
    new Emitter<string>()
  );
  public readonly onOutput = this.onOutputEmitter.event;
  private onStatusChangeEmitter = this.disposable.addDisposable(
    new Emitter<string>()
  );
  public readonly onStatusChange = this.onStatusChangeEmitter.event;
  private output: string[] = [];

  get name(): string {
    return this.step.name;
  }

  get command() {
    return this.step.command;
  }

  get status() {
    return this.step.finishStatus || "IDLE";
  }

  constructor(
    private stepIndex: number,
    private step: protocol.setup.Step,
    private agentClient: IAgentClient,
    private tracer?: Tracer
  ) {
    this.disposable.addDisposable(
      this.agentClient.setup.onSetupProgressUpdate((progress) => {
        const oldStep = this.step;
        const newStep = progress.steps[stepIndex];

        if (!newStep) {
          return;
        }

        this.step = newStep;

        if (newStep.finishStatus !== oldStep.finishStatus) {
          this.onStatusChangeEmitter.fire(newStep.finishStatus || "IDLE");
        }
      })
    );
    this.disposable.addDisposable(
      this.agentClient.shells.onShellOut(({ shellId, out }) => {
        if (shellId === this.step.shellId) {
          this.onOutputEmitter.fire(out);

          this.output.push(out);
          if (this.output.length > 1000) {
            this.output.shift();
          }
        }
      })
    );
  }

  private withSpan<T>(
    operationName: string,
    attributes: Record<string, any>,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.tracer) {
      return fn();
    }
    return this.tracer.startActiveSpan(operationName, { attributes }, async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async open(dimensions = DEFAULT_SHELL_SIZE): Promise<string> {
    return this.withSpan(
      "setup.stepOpen",
      {
        "step.index": this.stepIndex,
        "step.name": this.step.name,
        "step.command": this.step.command,
        "step.status": this.step.finishStatus || "IDLE",
        "step.shellId": this.step.shellId,
        "dimensions.cols": dimensions.cols,
        "dimensions.rows": dimensions.rows,
      },
      async () => {
        const open = async (shellId: protocol.shell.ShellId) => {
          const shell = await this.agentClient.shells.open(shellId, dimensions);

          this.output = shell.buffer;

          return this.output.join("\n");
        };

        if (this.step.shellId) {
          return open(this.step.shellId);
        }

        return new Promise<string>((resolve) => {
          const disposable = this.onStatusChange(() => {
            if (this.step.shellId) {
              disposable.dispose();
              resolve(open(this.step.shellId));
            }
          });
        });
      }
    );
  }

  async waitUntilComplete() {
    return this.withSpan(
      "setup.stepWaitUntilComplete",
      {
        "step.index": this.stepIndex,
        "step.name": this.step.name,
        "step.command": this.step.command,
        "step.status": this.step.finishStatus || "IDLE",
        "step.shellId": this.step.shellId,
      },
      async () => {
        if (this.step.finishStatus === "FAILED") {
          throw new Error("Step Failed");
        }

        if (
          this.step.finishStatus === "SUCCEEDED" ||
          this.step.finishStatus === "SKIPPED"
        ) {
          return;
        }

        return new Promise<void>((resolve, reject) => {
          const disposable = this.onStatusChange((status) => {
            if (status === "SUCCEEDED" || status === "SKIPPED") {
              disposable.dispose();
              resolve();
            } else if (status === "FAILED") {
              disposable.dispose();
              reject(new Error("Step Failed"));
            }
          });
        });
      }
    );
  }
}