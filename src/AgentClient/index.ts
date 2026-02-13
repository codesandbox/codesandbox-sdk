import {
  fs,
  PitcherErrorCode,
  PitcherRequest,
  port,
  setup,
  shell,
  task,
  version,
} from "../pitcher-protocol";
import {
  IAgentClient,
  IAgentClientFS,
  IAgentClientPorts,
  IAgentClientSetup,
  IAgentClientShells,
  IAgentClientSystem,
  IAgentClientTasks,
  PickRawFsResult,
  SubscribeShellEvent,
} from "../agent-client-interface";
import { AgentConnection } from "./AgentConnection";
import { Emitter, Event } from "../utils/event";
import { DEFAULT_SUBSCRIPTIONS, SandboxSession } from "../types";
import { SandboxClient } from "../SandboxClient";
import { InitStatus } from "../pitcher-protocol/messages/system";
import { IDisposable } from "@xterm/headless";
import { Disposable } from "../utils/disposable";

// Timeout for detecting a pong response, leading to a forced disconnect
// Increased from 15s to 30s to be more tolerant of network latency
let PONG_DETECTION_TIMEOUT = 30_000;

// When focusing the app we do a lower timeout to more quickly detect a potential disconnect
const FOCUS_PONG_DETECTION_TIMEOUT = 5_000;

type ShellStateChangeEvent =
  | { type: "out"; out: string }
  | { type: "exit"; exitCode: number };

class ShellState {
  private listener?: (event: ShellStateChangeEvent) => void;
  // The buffer is populated when there is no listener yet, ensuring that we capture
  // all output and return it
  private buffer: string[] = [];
  private exitCode?: number;
  getBuffer() {
    const bufferString = this.buffer.join("\n");
    this.buffer.length = 0;
    return bufferString;
  }
  getExitCode() {
    return this.exitCode;
  }
  addOut(out: string) {
    if (!this.listener) {
      this.buffer.push(out);
      return;
    }

    this.listener({
      type: "out",
      out,
    });
  }
  setExitCode(exitCode: number) {
    this.exitCode = exitCode;

    if (!this.listener) {
      return;
    }

    this.listener({
      type: "exit",
      exitCode,
    });
  }
  onChange(listener: (event: ShellStateChangeEvent) => void) {
    this.listener = listener;

    if (this.buffer.length) {
      const bufferString = this.buffer.join("\n");
      this.buffer.length = 0;
      listener({
        type: "out",
        out: bufferString,
      });
    }

    return () => {
      this.listener = undefined;
    };
  }
}

class AgentClientShells implements IAgentClientShells {
  disposeOutputListener: () => void;
  disposeExitListener: () => void;
  disposeTerminateListener: () => void;
  private shellStates: Record<string, ShellState> = {};
  constructor(private agentConnection: AgentConnection) {
    // We use a common listener to keep track of all shell output to avoid race conditions. These
    // are then flushed. This does not work with multiple listeners, but you would not use multiple
    // listeners for command/terminal output anyways. NOTE! These notifications only appear for created/opened shells
    this.disposeOutputListener = agentConnection.onNotification(
      "shell/out",
      (event) => {
        if (!this.shellStates[event.shellId]) {
          this.shellStates[event.shellId] = new ShellState();
        }

        this.shellStates[event.shellId].addOut(event.out);
      }
    );
    this.disposeExitListener = agentConnection.onNotification(
      "shell/exit",
      (event) => {
        if (!this.shellStates[event.shellId]) {
          this.shellStates[event.shellId] = new ShellState();
        }

        this.shellStates[event.shellId].setExitCode(event.exitCode);
      }
    );
    this.disposeTerminateListener = agentConnection.onNotification(
      "shell/terminate",
      (event) => {
        if (!this.shellStates[event.shellId]) {
          this.shellStates[event.shellId] = new ShellState();
        }

        this.shellStates[event.shellId].setExitCode(130);
      }
    );
  }
  create({
    command,
    args,
    size,
    type,
    isSystemShell,
    projectPath,
    cwd,
  }: {
    command: string;
    args: string[];
    projectPath: string;
    size: shell.ShellSize;
    type?: shell.ShellProcessType;
    isSystemShell?: boolean;
    cwd?: string;
  }): Promise<shell.OpenShellDTO> {
    // Pitcher protocol expects a single command string, so we concatenate command and args
    const fullCommand =
      args.length > 0 ? `${command} ${args.join(" ")}` : command;

    return this.agentConnection.request({
      method: "shell/create",
      params: {
        command: fullCommand,
        size,
        type,
        isSystemShell,
        cwd: cwd || projectPath,
      },
    });
  }
  delete(
    shellId: shell.ShellId
  ): Promise<shell.CommandShellDTO | shell.TerminalShellDTO | null> {
    return this.agentConnection.request({
      method: "shell/terminate",
      params: {
        shellId,
      },
    });
  }
  async getShells(): Promise<shell.ShellDTO[]> {
    const result = await this.agentConnection.request({
      method: "shell/list",
      params: {},
    });

    return result.shells;
  }
  subscribe(
    shellId: shell.ShellId,
    listener: (event: SubscribeShellEvent) => void
  ): IDisposable {
    const disposable = new Disposable();

    const disposeExit = this.agentConnection.onNotification(
      "shell/exit",
      (params) => {
        if (params.shellId === shellId) {
          listener({ type: "exit", exitCode: params.exitCode });
        }
      }
    );

    const disposeTerminate = this.agentConnection.onNotification(
      "shell/terminate",
      (params) => {
        if (params.shellId === shellId) {
          listener({ type: "terminate" });
        }
      }
    );

    disposable.onDidDispose(() => {
      disposeExit();
      disposeTerminate();
    });

    return disposable;
  }
  subscribeOutput(
    shellId: shell.ShellId,
    size: shell.ShellSize,
    listener: (event: { out: string; exitCode?: number }) => void
  ): IDisposable {
    const disposable = new Disposable();

    if (!this.shellStates[shellId]) {
      this.shellStates[shellId] = new ShellState();
    }

    const shellState = this.shellStates[shellId];

    if (shellState.getExitCode() !== undefined) {
      listener({
        out: shellState.getBuffer(),
        exitCode: shellState.getExitCode(),
      });

      return disposable;
    }

    const disposeChangeListener = shellState.onChange((event) => {
      if (event.type === "out") {
        listener({
          out: event.out,
        });
      } else {
        listener({
          out: shellState.getBuffer(),
          exitCode: event.exitCode,
        });
      }
    });

    disposable.onWillDispose(disposeChangeListener);

    // If subscribing to existing shell we need to open it to get events
    this.agentConnection
      .request({
        method: "shell/open",
        params: {
          shellId,
          size,
        },
      })
      .then((openShell) => {
        listener({
          out: openShell.buffer.join("\n"),
          exitCode: openShell.exitCode,
        });
      })
      .catch(() => {
        // The shell does not exist
      });

    disposable.onDidDispose(() => {
      this.agentConnection
        .request({
          method: "shell/close",
          params: {
            shellId,
            size,
          },
        })
        .catch(() => {
          // We do not care
        });
    });

    return disposable;
  }
  rename(shellId: shell.ShellId, name: string): Promise<null> {
    return this.agentConnection.request({
      method: "shell/rename",
      params: {
        shellId,
        name,
      },
    });
  }
  restart(shellId: shell.ShellId): Promise<null> {
    return this.agentConnection.request({
      method: "shell/restart",
      params: {
        shellId,
      },
    });
  }
  send(
    shellId: shell.ShellId,
    input: string,
    size: shell.ShellSize
  ): Promise<null> {
    return this.agentConnection.request({
      method: "shell/in",
      params: { shellId, input, size },
    });
  }
}

class AgentClientFS implements IAgentClientFS {
  constructor(
    private agentConnection: AgentConnection,
    private workspacePath: string
  ) {}
  private async handleRawFsResponse<
    T extends PitcherRequest["method"],
    B extends Extract<PitcherRequest, { method: T }>
  >(method: T, params: B["params"]): Promise<PickRawFsResult<T>> {
    try {
      // The params are right, the result is right too
      // eslint-disable-next-line
      const result = await this.agentConnection.request<any>({
        method,
        params,
      });

      return { type: "ok", result } as unknown as PickRawFsResult<T> & {
        type: "ok";
      };
    } catch (e) {
      // There's some weirdness with our error typing
      // eslint-disable-next-line
      const err = e as any;
      if ("code" in err) {
        if (err.code === PitcherErrorCode.RAWFS_ERROR) {
          return {
            type: "error",
            error: err.message,
            errno: err.data.errno,
          };
        }

        return { type: "error", error: err.message, errno: null };
      }

      if (err instanceof Error) {
        return { type: "error", error: err.message, errno: null };
      }

      return { type: "error", error: "unknown error", errno: null };
    }
  }
  copy(
    from: string,
    to: string,
    recursive?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/copy">> {
    return this.handleRawFsResponse("fs/copy", {
      from,
      to,
      recursive,
      overwrite,
    });
  }
  async download(path?: string): Promise<{ downloadUrl: string }> {
    return this.agentConnection.request({
      method: "fs/download",
      params: {
        path: path || this.workspacePath,
      },
    });
  }
  mkdir(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<"fs/mkdir">> {
    return this.handleRawFsResponse("fs/mkdir", {
      path,
      recursive,
    });
  }
  readdir(path: string): Promise<PickRawFsResult<"fs/readdir">> {
    return this.handleRawFsResponse("fs/readdir", {
      path,
    });
  }
  readFile(path: string): Promise<PickRawFsResult<"fs/readFile">> {
    return this.handleRawFsResponse("fs/readFile", {
      path,
    });
  }
  remove(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<"fs/remove">> {
    return this.handleRawFsResponse("fs/remove", {
      path,
      recursive,
    });
  }
  rename(path: string, newPath: string): Promise<PickRawFsResult<"fs/rename">> {
    return this.handleRawFsResponse("fs/rename", {
      from: path,
      to: newPath,
    });
  }
  stat(path: string): Promise<PickRawFsResult<"fs/stat">> {
    return this.handleRawFsResponse("fs/stat", {
      path,
    });
  }
  async watch(
    path: string,
    options: {
      readonly recursive?: boolean;
      readonly excludes?: readonly string[];
    },
    onEvent: (watchEvent: fs.FSWatchEvent) => void
  ): Promise<
    | (PickRawFsResult<"fs/watch"> & { type: "error" })
    | { type: "success"; dispose(): void }
  > {
    const response = await this.handleRawFsResponse("fs/watch", {
      path,
      recursive: options.recursive,
      // @ts-expect-error angry about using readonly here
      excludes: options.excludes,
    });

    if (response.type === "error") {
      return response;
    }

    const watchId = response.result.watchId;
    this.agentConnection.onNotification("fs/watchEvent", (params) => {
      if (params.watchId === watchId) {
        params.events.forEach(onEvent);
      }
    });

    return {
      type: "success" as const,
      dispose: () => {
        this.handleRawFsResponse("fs/unwatch", { watchId });
      },
    };
  }
  writeFile(
    path: string,
    content: Uint8Array,
    create?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<"fs/writeFile">> {
    return this.handleRawFsResponse("fs/writeFile", {
      path,
      content,
      create,
      overwrite,
    });
  }
}

class AgentClientPorts implements IAgentClientPorts {
  private onPortsUpdatedEmitter = new Emitter<port.Port[]>();
  onPortsUpdated = this.onPortsUpdatedEmitter.event;

  constructor(private agentConnection: AgentConnection) {
    this.agentConnection.onNotification("port/changed", (params) => {
      this.onPortsUpdatedEmitter.fire(params.list);
    });
  }
  async getPorts() {
    const result = await this.agentConnection.request({
      method: "port/list",
      params: {},
    });

    return result.list;
  }
}

class AgentClientSetup implements IAgentClientSetup {
  private onSetupProgressUpdateEmitter = new Emitter<setup.SetupProgress>();
  onSetupProgressUpdate = this.onSetupProgressUpdateEmitter.event;
  constructor(private agentConnection: AgentConnection) {
    this.agentConnection.onNotification("setup/progress", (params) => {
      this.onSetupProgressUpdateEmitter.fire(params);
    });
  }
  async getProgress() {
    return this.agentConnection.request({
      method: "setup/get",
      params: {},
    });
  }
  init() {
    return this.agentConnection.request({
      method: "setup/init",
      params: null,
    });
  }
}

class AgentClientTasks implements IAgentClientTasks {
  private onTaskUpdateEmitter = new Emitter<task.TaskDTO>();
  onTaskUpdate = this.onTaskUpdateEmitter.event;
  constructor(private agentConnection: AgentConnection) {
    this.agentConnection.onNotification("task/update", (params) => {
      this.onTaskUpdateEmitter.fire(params);
    });
  }
  getTasks() {
    return this.agentConnection.request({
      method: "task/list",
      params: {},
    });
  }
  async getTask(taskId: string): Promise<task.TaskDTO | undefined> {
    const tasks = await this.agentConnection.request({
      method: "task/list",
      params: {},
    });

    return tasks.tasks[taskId];
  }
  runTask(taskId: string): Promise<task.TaskDTO> {
    return this.agentConnection.request({
      method: "task/run",
      params: {
        taskId,
      },
    });
  }
  stopTask(taskId: string): Promise<task.TaskDTO | null> {
    return this.agentConnection.request({
      method: "task/stop",
      params: {
        taskId,
      },
    });
  }
}

class AgentClientSystem implements IAgentClientSystem {
  constructor(private agentConnection: AgentConnection) {
    this.agentConnection.onNotification("system/initStatus", (params) => {
      this.onInitStatusUpdateEmitter.fire(params);
    });
  }
  private onInitStatusUpdateEmitter = new Emitter<InitStatus>();
  onInitStatusUpdate = this.onInitStatusUpdateEmitter.event;
  update() {
    return this.agentConnection.request({
      method: "system/update",
      params: {},
    });
  }
}

export class AgentClient implements IAgentClient {
  readonly type = "pitcher" as const;
  static async create({
    session,
    getSession,
  }: {
    session: SandboxSession;
    getSession: (sandboxId: string) => Promise<SandboxSession>;
  }) {
    const url = `${session.pitcherURL}/?token=${session.pitcherToken}`;
    const agentConnection = await AgentConnection.create(url);
    const joinResult = await agentConnection.request({
      method: "client/join",
      params: {
        clientInfo: {
          protocolVersion: version,
          appId: "sdk",
        },
        asyncProgress: true,
        subscriptions: DEFAULT_SUBSCRIPTIONS,
      },
    });

    // Connection is fully established after successful client/join
    agentConnection.state = "CONNECTED";

    // Now that we have initialized we set an appropriate timeout to more efficiently detect disconnects
    agentConnection.connection.setPongDetectionTimeout(PONG_DETECTION_TIMEOUT);

    return {
      client: new AgentClient(getSession, agentConnection, {
        sandboxId: session.sandboxId,
        workspacePath: session.userWorkspacePath,
        reconnectToken: joinResult.reconnectToken,
        isUpToDate: session.latestPitcherVersion === session.pitcherVersion,
      }),
      joinResult,
    };
  }

  sandboxId: string;
  workspacePath: string;
  isUpToDate: boolean;
  private reconnectToken: string;
  get state() {
    return this.agentConnection.state;
  }
  onStateChange = this.agentConnection.onStateChange;
  shells = new AgentClientShells(this.agentConnection);
  fs = new AgentClientFS(this.agentConnection, this.params.workspacePath);
  setup = new AgentClientSetup(this.agentConnection);
  tasks = new AgentClientTasks(this.agentConnection);
  system = new AgentClientSystem(this.agentConnection);
  ports = new AgentClientPorts(this.agentConnection);

  constructor(
    private getSession: (sandboxId: string) => Promise<SandboxSession>,
    private agentConnection: AgentConnection,
    private params: {
      sandboxId: string;
      workspacePath: string;
      isUpToDate: boolean;
      reconnectToken: string;
    }
  ) {
    this.sandboxId = params.sandboxId;
    this.workspacePath = params.workspacePath;
    this.isUpToDate = params.isUpToDate;
    this.reconnectToken = params.reconnectToken;
  }
  ping() {
    this.agentConnection.connection.ping(FOCUS_PONG_DETECTION_TIMEOUT);
  }
  async disconnect(): Promise<void> {
    await this.agentConnection.disconnect();
  }
  async reconnect(): Promise<void> {
    const newReconnectToken = await this.agentConnection.reconnect(
      this.reconnectToken,
      async () => {
        const session = await this.getSession(this.params.sandboxId);

        return {
          url: session.pitcherURL,
          token: session.pitcherToken,
        };
      }
    );

    // Update the reconnect token if we got a new one
    if (newReconnectToken) {
      this.reconnectToken = newReconnectToken;
    }
  }
  dispose() {
    this.shells.disposeOutputListener();
    this.shells.disposeExitListener();
    this.shells.disposeTerminateListener();
    this.agentConnection.dispose();
  }
}
