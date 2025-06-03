import { Commands } from "./commands";
import { IAgentClient } from "../agent-client-interface";

/**
 * An interface to interact with the git repository.
 *
 * The class is initialized with a `pitcherClient` and a `commands` object.
 * The `pitcherClient` object is used to communicate with the Pitcher server.
 * The `commands` object is used to run shell commands.
 *
 * The interface provides methods to commit changes to git, checkout a branch,
 * and push changes to git.
 *
 * The interface also provides an event `onStatusChange` that is emitted when
 * the git status changes.
 */
export class Git {
  /**
   * An event that is emitted when the git status changes.
   */
  onStatusChange = this.agentClient.git.onStatusUpdated;

  constructor(private agentClient: IAgentClient, private commands: Commands) {}

  /**
   * Get the current git status.
   */
  status() {
    return this.agentClient.git.getStatus();
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
    await this.commands.run(["git push -u origin HEAD"]);
  }

  async clone(opts: { url: string; branch: string }) {
    await this.commands.run([
      "rm -rf .git",
      "git init",
      `git remote add origin ${opts.url}`,
      "git fetch origin",
      `git checkout -b ${opts.branch}`,
      `git reset --hard origin/${opts.branch}`,
    ]);
  }
}
