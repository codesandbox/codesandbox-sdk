import type { IPitcherClient } from "@codesandbox/pitcher-client";
import { Commands } from "./commands";

export class Git {
  /**
   * An event that is emitted when the git status changes.
   */
  onStatusChange = this.pitcherClient.clients.git.onStatusUpdated;

  constructor(
    private pitcherClient: IPitcherClient,
    private commands: Commands
  ) {}

  /**
   * Get the current git status.
   */
  status() {
    return this.pitcherClient.clients.git.getStatus();
  }

  /**
   * Commit all changes to git
   */
  async commit(message: string) {
    const messageWithQuotesEscaped = message.replace(/"/g, '\\"');

    await this.commands.run([
      "git add .",
      `git commit -m "${messageWithQuotesEscaped}"`,
    ]);
  }

  /**
   * Checkout a branch
   */
  async checkout(branch: string, isNewBranch = false) {
    if (isNewBranch) {
      await this.commands.run([
        "git checkout -b " + branch,
        "git push --set-upstream origin " + branch,
      ]);
      return;
    }

    await this.commands.run(["git checkout " + branch]);
  }

  /**
   * Push all changes to git
   */
  async push() {
    await this.commands.run(["git push"]);
  }
}
