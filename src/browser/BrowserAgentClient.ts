import { Id, IPitcherClient } from "@codesandbox/pitcher-client";
import { IAgentClient, IAgentClientShells } from "../agent-client-interface";
import { shell } from "@codesandbox/pitcher-protocol";

class Shells implements IAgentClientShells {
  onShellExited = this.pitcherClient.clients.shell.onShellExited;
  onShellTerminated = this.pitcherClient.clients.shell.onShellTerminated;
  onShellOut = this.pitcherClient.clients.shell.onShellOut;
  constructor(private pitcherClient: IPitcherClient) {}
  create(
    projectPath: string,
    size: shell.ShellSize,
    command?: string,
    type?: shell.ShellProcessType,
    isSystemShell?: boolean
  ) {
    return this.pitcherClient.clients.shell.create(
      projectPath,
      size,
      command,
      type,
      isSystemShell
    );
  }
  rename(shellId: Id, name: string): Promise<null> {
    return this.pitcherClient.clients.shell.rename(shellId, name);
  }
  async getShells(): Promise<shell.ShellDTO[]> {
    return this.pitcherClient.clients.shell.getShells();
  }
  async open(shellId: Id, size: shell.ShellSize): Promise<shell.OpenShellDTO> {
    return this.pitcherClient.clients.shell.open(shellId, size);
  }
  async delete(
    shellId: Id
  ): Promise<shell.CommandShellDTO | shell.TerminalShellDTO | null> {
    return this.pitcherClient.clients.shell.delete(shellId);
  }
  async restart(shellId: Id): Promise<null> {
    return this.pitcherClient.clients.shell.restart(shellId);
  }
}

export class BrowserAgent implements IAgentClient {
  shells = new Shells(this.pitcherClient);

  constructor(private pitcherClient: IPitcherClient) {}
}
