import type { Id, IPitcherClient } from "@codesandbox/pitcher-client";
import { listenOnce } from "@codesandbox/pitcher-common/dist/event";

import { Disposable } from "../../utils/disposable";
import { Emitter } from "../../utils/event";

export class Setup {
  private disposable = new Disposable();
  private readonly onSetupProgressUpdateEmitter = this.disposable.addDisposable(
    new Emitter<SetupProgress>()
  );
  /**
   * Emitted when the setup progress is updated.
   */
  public readonly onSetupProgressUpdate =
    this.onSetupProgressUpdateEmitter.event;

  constructor(
    sessionDisposable: Disposable,
    private pitcherClient: IPitcherClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
    this.disposable.addDisposable(
      pitcherClient.clients.setup.onSetupProgressUpdate((progress) => {
        this.onSetupProgressUpdateEmitter.fire(progress);
      })
    );
  }

  /**
   * Run the setup tasks, this will prepare the docker image, and run the user defined
   * setup steps. This will automatically run when a sandbox is started.
   */
  async run(): Promise<SetupProgress> {
    return this.pitcherClient.clients.setup.init();
  }

  /**
   * Returns the current progress of the setup tasks.
   */
  async getProgress(): Promise<SetupProgress> {
    await this.pitcherClient.clients.setup.readyPromise;
    return this.pitcherClient.clients.setup.getProgress();
  }

  async waitForFinish(): Promise<SetupProgress> {
    const progress = await this.getProgress();
    if (progress.state === "FINISHED") {
      return Promise.resolve(progress);
    }

    return listenOnce(this.onSetupProgressUpdate, (progress) => {
      return progress.state === "FINISHED";
    });
  }
}

export type SetupProgress = {
  state: "IDLE" | "IN_PROGRESS" | "FINISHED" | "STOPPED";
  steps: Step[];
  currentStepIndex: number;
};

export type SetupShellStatus = "SUCCEEDED" | "FAILED" | "SKIPPED";

export type Step = {
  name: string;
  command: string;
  shellId: Id | null;
  finishStatus: SetupShellStatus | null;
};
