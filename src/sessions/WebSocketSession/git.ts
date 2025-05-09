import type { Id, IPitcherClient } from "@codesandbox/pitcher-client";

export class Git {
  onStatusChange = this.pitcherClient.clients.git.onStatusUpdated;
  constructor(private pitcherClient: IPitcherClient) {}
  pull(force?: boolean) {
    return this.pitcherClient.clients.git.pull(undefined, force);
  }
  commit(message: string, paths?: string[]) {
    return this.pitcherClient.clients.git.commit(message, paths);
  }
  push() {
    return this.pitcherClient.clients.git.push();
  }
  status() {
    return this.pitcherClient.clients.git.getStatus();
  }
  discard(path?: string[]) {
    return this.pitcherClient.clients.git.discard(path);
  }
  resetToRemote() {
    return this.pitcherClient.clients.git.resetLocalWithRemote();
  }
  // TODO: Expose git checkout
  checkout(branch: string) {
    return this.pitcherClient.clients.task.runCommand(`git checkout ${branch}`);
  }
}
