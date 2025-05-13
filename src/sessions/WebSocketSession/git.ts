import type { IPitcherClient } from "@codesandbox/pitcher-client";

export class Git {
  onStatusChange = this.pitcherClient.clients.git.onStatusUpdated;
  constructor(private pitcherClient: IPitcherClient) {}
  status() {
    return this.pitcherClient.clients.git.getStatus();
  }
}
