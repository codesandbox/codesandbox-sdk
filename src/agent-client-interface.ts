import { Id, Event, Emitter } from "@codesandbox/pitcher-common";
import {
  fs,
  git,
  port,
  PitcherRequest,
  PitcherResponse,
  PitcherResponseStatus,
  shell,
  setup,
  task,
} from "@codesandbox/pitcher-protocol";

export interface IAgentClientShells {
  onShellExited: Event<{
    shellId: Id;
    exitCode: number;
  }>;
  onShellTerminated: Event<shell.ShellTerminateNotification["params"]>;
  onShellOut: Event<shell.ShellOutNotification["params"]>;
  create(
    projectPath: string,
    size: shell.ShellSize,
    command?: string,
    type?: shell.ShellProcessType,
    isSystemShell?: boolean
  ): Promise<shell.OpenShellDTO>;
  rename(shellId: Id, name: string): Promise<null>;
  getShells(): Promise<shell.ShellDTO[]>;
  open(shellId: Id, size: shell.ShellSize): Promise<shell.OpenShellDTO>;
  delete(
    shellId: Id
  ): Promise<shell.CommandShellDTO | shell.TerminalShellDTO | null>;
  restart(shellId: Id): Promise<null>;
  send(shellId: Id, input: string, size: shell.ShellSize): Promise<null>;
}

export type RawFsResult<T> =
  | { type: "ok"; result: T }
  | { type: "error"; error: string; errno: number | null };

export type PickRawFsResult<T extends PitcherRequest["method"]> = RawFsResult<
  Extract<
    PitcherResponse,
    { method: T; status: PitcherResponseStatus.RESOLVED }
  >["result"]
>;

export interface IAgentClientFS {
  readFile(path: string): Promise<PickRawFsResult<"fs/readFile">>;
  readdir(path: string): Promise<PickRawFsResult<"fs/readdir">>;
  writeFile(
    path: string,
    content: Uint8Array,
    create?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/writeFile">>;
  stat(path: string): Promise<PickRawFsResult<"fs/stat">>;
  copy(
    from: string,
    to: string,
    recursive?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/copy">>;
  rename(
    from: string,
    to: string,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/rename">>;
  remove(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<"fs/remove">>;
  mkdir(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<"fs/mkdir">>;
  watch(
    path: string,
    options: {
      readonly recursive?: boolean;
      readonly excludes?: readonly string[];
    },
    onEvent: (watchEvent: fs.FSWatchEvent) => void
  ): Promise<
    | (PickRawFsResult<"fs/watch"> & { type: "error" })
    | { type: "success"; dispose(): void }
  >;
  download(path?: string): Promise<{ downloadUrl: string }>;
}

export interface IAgentClientGit {
  onStatusUpdated: Event<git.GitStatus>;
  getStatus(): Promise<git.GitStatus>;
}

export interface IAgentClientPorts {
  onPortsUpdated: Event<port.Port[]>;
  getPorts(): Promise<port.Port[]>;
}

export interface IAgentClientSetup {
  onSetupProgressUpdate: Event<setup.SetupProgress>;
  getProgress(): Promise<setup.SetupProgress>;
  init(): Promise<setup.SetupProgress>;
}

export interface IAgentClientTasks {
  onTaskUpdate: Event<task.TaskDTO>;
  getTasks(): Promise<task.TaskListDTO>;
  getTask(taskId: string): Promise<task.TaskDTO | undefined>;
  runTask(taskId: string): Promise<task.TaskDTO>;
  stopTask(taskId: string): Promise<task.TaskDTO | null>;
}

export interface IAgentClientSystem {
  update(): Promise<Record<string, undefined>>;
}

export type IAgentClientState =
  | "CONNECTED"
  | "CONNECTING"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "HIBERNATED";

export interface IAgentClient {
  sandboxId: string;
  workspacePath: string;
  isUpToDate: boolean;
  state: IAgentClientState;
  onStateChange: Event<IAgentClientState>;
  shells: IAgentClientShells;
  fs: IAgentClientFS;
  git: IAgentClientGit;
  ports: IAgentClientPorts;
  setup: IAgentClientSetup;
  tasks: IAgentClientTasks;
  system: IAgentClientSystem;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  dispose(): void;
}
