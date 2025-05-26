import { Id, Event } from "@codesandbox/pitcher-common";
import { shell } from "@codesandbox/pitcher-protocol";

export interface IAgentClientShells {
  onShellExited: Event<{
    shellId: Id;
    exitCode: number;
  }>;
  onShellTerminated: Event<{
    shellId: Id;
    author: string;
  }>;
  onShellOut: Event<shell.ShellOutNotification["params"]>;
  create(
    projectPath: string,
    size: shell.ShellSize,
    command?: string,
    type?: shell.ShellProcessType,
    isSystemShell?: boolean
  ): Promise<shell.ShellDTO>;
  rename(shellId: Id, name: string): Promise<null>;
  getShells(): Promise<shell.ShellDTO[]>;
  open(shellId: Id, size: shell.ShellSize): Promise<shell.OpenShellDTO>;
  delete(
    shellId: Id
  ): Promise<shell.CommandShellDTO | shell.TerminalShellDTO | null>;
  restart(shellId: Id): Promise<null>;
}

export interface IAgentClient {
  // this.pitcherClient.workspacePath
  workspacePath: string;
  shells: IAgentClientShells;
}
