import type { IPitcherClient } from "@codesandbox/pitcher-client";

export class Git {
  /**
   * An event that is emitted when the git status changes.
   */
  onStatusChange = this.pitcherClient.clients.git.onStatusUpdated;

  constructor(private pitcherClient: IPitcherClient) {}

  /**
   * Get the current git status.
   */
  status() {
    return this.pitcherClient.clients.git.getStatus();
  }
}
