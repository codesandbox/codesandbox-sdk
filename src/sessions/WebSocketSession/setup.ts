import {
  Barrier,
  type IPitcherClient,
  type protocol,
} from "@codesandbox/pitcher-client";

import { Disposable } from "../../utils/disposable";
import { Emitter } from "../../utils/event";
import { DEFAULT_SHELL_SIZE } from "./terminals";

export class Setup {
  private disposable = new Disposable();
  private steps: Promise<Step[]>;
  private setupProgress: protocol.setup.SetupProgress;
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
    private pitcherClient: IPitcherClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });

    // We have a race condition where we might not have the steps yet and need
    // an event to tell us when they have started. But we might also have all the steps,
    // where no new event will arrive. So we use a barrier to manage this
    const initialStepsBarrier = new Barrier<Step[]>();

    this.setupProgress = this.pitcherClient.clients.setup.getProgress();
    this.steps = initialStepsBarrier
      .wait()
      .then((result) => (result.status === "resolved" ? result.value : []));

    let hasInitializedSteps = Boolean(this.setupProgress.steps.length);

    if (hasInitializedSteps) {
      initialStepsBarrier.open(
        this.setupProgress.steps.map(
          (step, index) => new Step(index, step, pitcherClient)
        )
      );
    }

    this.disposable.addDisposable(
      pitcherClient.clients.setup.onSetupProgressUpdate((progress) => {
        if (!hasInitializedSteps) {
          hasInitializedSteps = true;
          initialStepsBarrier.open(
            progress.steps.map(
              (step, index) => new Step(index, step, pitcherClient)
            )
          );
        }

        this.setupProgress = progress;
        this.onSetupProgressChangeEmitter.fire();
      })
    );
  }

  getSteps() {
    return this.steps;
  }

  async run(): Promise<void> {
    await this.pitcherClient.clients.setup.init();
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
    private pitcherClient: IPitcherClient
  ) {
    this.disposable.addDisposable(
      this.pitcherClient.clients.setup.onSetupProgressUpdate((progress) => {
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
      this.pitcherClient.clients.shell.onShellOut(({ shellId, out }) => {
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
      const shell = await this.pitcherClient.clients.shell.open(
        shellId,
        dimensions
      );

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
