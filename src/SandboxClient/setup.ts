import * as protocol from "../pitcher-protocol";
import { Disposable } from "../utils/disposable";
import { Emitter } from "../utils/event";
import { DEFAULT_SHELL_SIZE } from "./terminals";
import { IAgentClient } from "../AgentClient/agent-client-interface";

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
    private setupProgress: protocol.setup.SetupProgress
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
    this.steps = this.setupProgress.steps.map(
      (step, index) => new Step(index, step, agentClient)
    );
  }

  getSteps() {
    return this.steps;
  }

  async run(): Promise<void> {
    await this.agentClient.setup.init();
  }

  async waitUntilComplete(): Promise<void> {
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
    stepIndex: number,
    private step: protocol.setup.Step,
    private agentClient: IAgentClient
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

  async open(dimensions = DEFAULT_SHELL_SIZE): Promise<string> {
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

  async waitUntilComplete() {
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
}
