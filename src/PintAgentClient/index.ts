import { createClient } from '@hey-api/client-fetch';
import * as PintAPI from '../api-clients/client-pint';
import {
  IAgentClient,
  IAgentClientFS,
  IAgentClientPorts,
  IAgentClientSetup,
  IAgentClientShells,
  IAgentClientState,
  IAgentClientSystem,
  IAgentClientTasks,
  PickRawFsResult,
  RawFsResult,
} from '../agent-client-interface';
import { Event, Emitter } from '../utils/event';
import { Disposable } from '../utils/disposable';
import {
  fs,
  port,
  shell,
  setup,
  system,
  task,
} from '../pitcher-protocol';

export class PintAgentClient implements IAgentClient {
  private client = createClient({
    baseUrl: `http://localhost:${this.port}`,
    headers: {
      Authorization: `Bearer ${this.authToken}`,
    },
  });

  private _state: IAgentClientState = 'CONNECTING';
  private _onStateChange = new Emitter<IAgentClientState>();
  
  private _shells: PintAgentClientShells;
  private _fs: PintAgentClientFS;
  private _ports: PintAgentClientPorts;
  private _setup: PintAgentClientSetup;
  private _tasks: PintAgentClientTasks;
  private _system: PintAgentClientSystem;

  constructor(
    public sandboxId: string,
    public workspacePath: string,
    private port: number,
    private authToken: string
  ) {
    this._shells = new PintAgentClientShells(this.client);
    this._fs = new PintAgentClientFS(this.client);
    this._ports = new PintAgentClientPorts(this.client);
    this._setup = new PintAgentClientSetup(this.client);
    this._tasks = new PintAgentClientTasks(this.client);
    this._system = new PintAgentClientSystem(this.client);
    
    this.initialize();
  }

  get isUpToDate(): boolean {
    return true; // TODO: Implement version checking
  }

  get state(): IAgentClientState {
    return this._state;
  }

  get onStateChange(): Event<IAgentClientState> {
    return this._onStateChange.event;
  }

  get shells(): IAgentClientShells {
    return this._shells;
  }

  get fs(): IAgentClientFS {
    return this._fs;
  }

  get ports(): IAgentClientPorts {
    return this._ports;
  }

  get setup(): IAgentClientSetup {
    return this._setup;
  }

  get tasks(): IAgentClientTasks {
    return this._tasks;
  }

  get system(): IAgentClientSystem {
    return this._system;
  }

  private async initialize() {
    try {
      await this.ping();
      this.setState('CONNECTED');
    } catch (error) {
      this.setState('DISCONNECTED');
    }
  }

  private setState(state: IAgentClientState) {
    if (this._state !== state) {
      this._state = state;
      this._onStateChange.fire(state);
    }
  }

  async ping(): Promise<void> {
    try {
      await PintAPI.getHealth({ client: this.client });
    } catch (error) {
      throw new Error(`Ping failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.setState('DISCONNECTED');
  }

  async reconnect(): Promise<void> {
    this.setState('RECONNECTING');
    try {
      await this.ping();
      this.setState('CONNECTED');
    } catch (error) {
      this.setState('DISCONNECTED');
      throw error;
    }
  }

  dispose(): void {
    this._onStateChange.dispose();
    this._shells.dispose();
    this._fs.dispose();
    this._ports.dispose();
    this._setup.dispose();
    this._tasks.dispose();
    this._system.dispose();
  }
}

class PintAgentClientShells implements IAgentClientShells {
  private _onShellExited = new Emitter<{ shellId: string; exitCode: number }>();
  private _onShellTerminated = new Emitter<shell.ShellTerminateNotification['params']>();
  private _onShellOut = new Emitter<shell.ShellOutNotification['params']>();

  constructor(private client: any) {}

  get onShellExited(): Event<{ shellId: string; exitCode: number }> {
    return this._onShellExited.event;
  }

  get onShellTerminated(): Event<shell.ShellTerminateNotification['params']> {
    return this._onShellTerminated.event;
  }

  get onShellOut(): Event<shell.ShellOutNotification['params']> {
    return this._onShellOut.event;
  }

  async create(
    projectPath: string,
    size: shell.ShellSize,
    command?: string,
    type?: shell.ShellProcessType,
    isSystemShell?: boolean
  ): Promise<shell.OpenShellDTO> {
    const response = await PintAPI.postApiTerminals({
      client: this.client,
      body: {
        command: command || 'bash',
        args: [],
        workingDir: projectPath,
      },
    });

    if (!response.data?.terminal) {
      throw new Error('Failed to create terminal');
    }

    // Convert Pint API response to shell.OpenShellDTO format
    const terminal = response.data.terminal;
    return {
      shellId: terminal.id,
      name: `Terminal ${terminal.id}`,
      status: this.mapTerminalStatus(terminal.status),
      exitCode: undefined,
      shellType: type === 'COMMAND' ? 'COMMAND' : 'TERMINAL',
      ...(type === 'COMMAND'
        ? { startCommand: command || 'bash' }
        : {
            ownerUsername: 'user',
            isSystemShell: isSystemShell || false,
          }),
      buffer: [], // Will be populated by stdout calls
    } as shell.OpenShellDTO;
  }

  async rename(shellId: shell.ShellId, name: string): Promise<null> {
    // Pint API doesn't have rename endpoint, so we'll just return null
    return null;
  }

  async getShells(): Promise<shell.ShellDTO[]> {
    const response = await PintAPI.getApiTerminals({ client: this.client });
    
    if (!response.data?.terminals) {
      return [];
    }

    return response.data.terminals.map((terminal) => ({
      shellId: terminal.id,
      name: `Terminal ${terminal.id}`,
      status: this.mapTerminalStatus(terminal.status),
      exitCode: undefined,
      shellType: 'TERMINAL' as const,
      ownerUsername: 'user',
      isSystemShell: false,
    }));
  }

  async open(
    shellId: shell.ShellId,
    size: shell.ShellSize
  ): Promise<shell.OpenShellDTO> {
    const response = await PintAPI.getApiTerminalsById({
      client: this.client,
      path: { id: shellId },
    });

    if (!response.data?.terminal) {
      throw new Error(`Terminal ${shellId} not found`);
    }

    const terminal = response.data.terminal;
    
    // Get terminal output for buffer
    const outputResponse = await PintAPI.getApiTerminalsByIdStdout({
      client: this.client,
      path: { id: shellId },
    });

    const buffer = typeof outputResponse.data === 'string' 
      ? outputResponse.data.split('\n') 
      : [];

    return {
      shellId: terminal.id,
      name: `Terminal ${terminal.id}`,
      status: this.mapTerminalStatus(terminal.status),
      exitCode: undefined,
      shellType: 'TERMINAL',
      ownerUsername: 'user',
      isSystemShell: false,
      buffer,
    };
  }

  async delete(
    shellId: shell.ShellId
  ): Promise<shell.CommandShellDTO | shell.TerminalShellDTO | null> {
    const terminalResponse = await PintAPI.getApiTerminalsById({
      client: this.client,
      path: { id: shellId },
    });

    if (!terminalResponse.data?.terminal) {
      return null;
    }

    const terminal = terminalResponse.data.terminal;

    await PintAPI.deleteApiTerminalsById({
      client: this.client,
      path: { id: shellId },
    });

    return {
      shellId: terminal.id,
      name: `Terminal ${terminal.id}`,
      status: this.mapTerminalStatus(terminal.status),
      exitCode: undefined,
      shellType: 'TERMINAL',
      ownerUsername: 'user',
      isSystemShell: false,
    };
  }

  async restart(shellId: shell.ShellId): Promise<null> {
    // Pint API doesn't have restart endpoint for terminals
    // We could delete and recreate, but for now just return null
    return null;
  }

  async send(
    shellId: shell.ShellId,
    input: string,
    size: shell.ShellSize
  ): Promise<null> {
    await PintAPI.postApiTerminalsByIdStdin({
      client: this.client,
      path: { id: shellId },
      body: { input },
    });
    return null;
  }

  private mapTerminalStatus(status: string): shell.ShellProcessStatus {
    switch (status) {
      case 'created':
        return 'RUNNING';
      case 'running':
        return 'RUNNING';
      case 'finished':
        return 'FINISHED';
      case 'error':
        return 'ERROR';
      default:
        return 'RUNNING';
    }
  }

  dispose(): void {
    this._onShellExited.dispose();
    this._onShellTerminated.dispose();
    this._onShellOut.dispose();
  }
}

class PintAgentClientFS implements IAgentClientFS {
  constructor(private client: any) {}

  async readFile(path: string): Promise<PickRawFsResult<'fs/readFile'>> {
    try {
      const response = await PintAPI.getApiFsFilesByPath({
        client: this.client,
        path: { path },
      });

      if (typeof response.data === 'string') {
        return {
          type: 'ok',
          result: {
            content: new TextEncoder().encode(response.data),
          },
        };
      }

      return {
        type: 'error',
        error: 'Invalid response format',
        errno: null,
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async readdir(path: string): Promise<PickRawFsResult<'fs/readdir'>> {
    try {
      const response = await PintAPI.getApiDirectoriesByPath({
        client: this.client,
        path: { path },
      });

      if (!response.data?.entries) {
        return {
          type: 'error',
          error: 'Invalid response format',
          errno: null,
        };
      }

      return {
        type: 'ok',
        result: {
          entries: response.data.entries.map((entry) => ({
            name: entry.name,
            type: entry.isDir ? 'directory' : 'file',
          })),
        },
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async writeFile(
    path: string,
    content: Uint8Array,
    create?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<'fs/writeFile'>> {
    try {
      await PintAPI.putApiFsFilesByPath({
        client: this.client,
        path: { path },
        body: {
          operation: 'write',
          content: new TextDecoder().decode(content),
        },
      });

      return {
        type: 'ok',
        result: {},
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async stat(path: string): Promise<PickRawFsResult<'fs/stat'>> {
    try {
      const response = await PintAPI.getApiFsStatsByPath({
        client: this.client,
        path: { path },
      });

      if (!response.data) {
        return {
          type: 'error',
          error: 'File not found',
          errno: null,
        };
      }

      return {
        type: 'ok',
        result: {
          type: response.data.isDir ? 'directory' : 'file',
          size: response.data.size,
          mtime: new Date(response.data.modTime).getTime(),
          ctime: new Date(response.data.modTime).getTime(), // Use modTime as ctime
        },
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async copy(
    from: string,
    to: string,
    recursive?: boolean,
    overwrite?: boolean
  ): Promise<PickRawFsResult<'fs/copy'>> {
    try {
      await PintAPI.putApiFsFilesByPath({
        client: this.client,
        path: { path: to },
        body: {
          operation: 'copyFrom',
          source: from,
        },
      });

      return {
        type: 'ok',
        result: {},
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async rename(
    from: string,
    to: string,
    overwrite?: boolean
  ): Promise<PickRawFsResult<'fs/rename'>> {
    try {
      await PintAPI.putApiFsFilesByPath({
        client: this.client,
        path: { path: to },
        body: {
          operation: 'moveFrom',
          source: from,
        },
      });

      return {
        type: 'ok',
        result: {},
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async remove(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<'fs/remove'>> {
    try {
      // Try to stat first to see if it's a file or directory
      const statResponse = await PintAPI.getApiFsStatsByPath({
        client: this.client,
        path: { path },
      });

      if (statResponse.data?.isDir) {
        await PintAPI.deleteApiDirectoriesByPath({
          client: this.client,
          path: { path },
        });
      } else {
        await PintAPI.deleteApiFsFilesByPath({
          client: this.client,
          path: { path },
        });
      }

      return {
        type: 'ok',
        result: {},
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async mkdir(
    path: string,
    recursive?: boolean
  ): Promise<PickRawFsResult<'fs/mkdir'>> {
    try {
      await PintAPI.postApiDirectoriesByPath({
        client: this.client,
        path: { path },
      });

      return {
        type: 'ok',
        result: {},
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async watch(
    path: string,
    options: {
      readonly recursive?: boolean;
      readonly excludes?: readonly string[];
    },
    onEvent: (watchEvent: fs.FSWatchEvent) => void
  ): Promise<
    | (PickRawFsResult<'fs/watch'> & { type: 'error' })
    | { type: 'success'; dispose(): void }
  > {
    try {
      // Create a glob pattern from path and options
      let globPattern = path;
      if (options.recursive) {
        globPattern = `${path}/**/*`;
      }

      // Note: Real implementation would need to handle SSE for watch events
      // For now, we'll return a mock success response
      return {
        type: 'success',
        dispose() {
          // Cleanup watch subscription
        },
      };
    } catch (error) {
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errno: null,
      };
    }
  }

  async download(path?: string): Promise<{ downloadUrl: string }> {
    // Pint API doesn't have download endpoint, return placeholder
    return {
      downloadUrl: `http://localhost/download${path ? `?path=${encodeURIComponent(path)}` : ''}`,
    };
  }

  dispose(): void {
    // Cleanup any subscriptions
  }
}

class PintAgentClientPorts implements IAgentClientPorts {
  private _onPortsUpdated = new Emitter<port.Port[]>();

  constructor(private client: any) {}

  get onPortsUpdated(): Event<port.Port[]> {
    return this._onPortsUpdated.event;
  }

  async getPorts(): Promise<port.Port[]> {
    const response = await PintAPI.getApiPorts({ client: this.client });
    
    if (!response.data?.ports) {
      return [];
    }

    return response.data.ports.map((p) => ({
      port: p.port,
      state: p.status === 'open' ? 'OPEN' : 'CLOSED',
      hostname: p.address || 'localhost',
      preview: undefined, // TODO: Determine preview URL
      process: p.process,
    }));
  }

  dispose(): void {
    this._onPortsUpdated.dispose();
  }
}

class PintAgentClientSetup implements IAgentClientSetup {
  private _onSetupProgressUpdate = new Emitter<setup.SetupProgress>();

  constructor(private client: any) {}

  get onSetupProgressUpdate(): Event<setup.SetupProgress> {
    return this._onSetupProgressUpdate.event;
  }

  async getProgress(): Promise<setup.SetupProgress> {
    const response = await PintAPI.getApiState({ client: this.client });
    
    return {
      hasRunSetup: response.data?.setupCompleted || false,
      steps: [],
    };
  }

  async init(): Promise<setup.SetupProgress> {
    return this.getProgress();
  }

  dispose(): void {
    this._onSetupProgressUpdate.dispose();
  }
}

class PintAgentClientTasks implements IAgentClientTasks {
  private _onTaskUpdate = new Emitter<task.TaskDTO>();

  constructor(private client: any) {}

  get onTaskUpdate(): Event<task.TaskDTO> {
    return this._onTaskUpdate.event;
  }

  async getTasks(): Promise<task.TaskListDTO> {
    const response = await PintAPI.getApiTasks({ client: this.client });
    
    if (!response.data?.tasks) {
      return { tasks: [] };
    }

    return {
      tasks: response.data.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        status: this.mapTaskStatus(t.status),
        command: t.command,
        terminalId: t.terminalId,
      })),
    };
  }

  async getTask(taskId: string): Promise<task.TaskDTO | undefined> {
    try {
      const response = await PintAPI.getApiTasksById({
        client: this.client,
        path: { id: taskId },
      });

      if (!response.data?.task) {
        return undefined;
      }

      const t = response.data.task;
      return {
        id: t.id,
        name: t.name,
        status: this.mapTaskStatus(t.status),
        command: t.command,
        terminalId: t.terminalId,
      };
    } catch (error) {
      return undefined;
    }
  }

  async runTask(taskId: string): Promise<task.TaskDTO> {
    const response = await PintAPI.postApiTasksByIdRun({
      client: this.client,
      path: { id: taskId },
    });

    if (!response.data?.task) {
      throw new Error(`Failed to run task ${taskId}`);
    }

    const t = response.data.task;
    return {
      id: t.id,
      name: t.name,
      status: this.mapTaskStatus(t.status),
      command: t.command,
      terminalId: t.terminalId,
    };
  }

  async stopTask(taskId: string): Promise<task.TaskDTO | null> {
    try {
      const response = await PintAPI.postApiTasksByIdStop({
        client: this.client,
        path: { id: taskId },
      });

      if (!response.data?.task) {
        return null;
      }

      const t = response.data.task;
      return {
        id: t.id,
        name: t.name,
        status: this.mapTaskStatus(t.status),
        command: t.command,
        terminalId: t.terminalId,
      };
    } catch (error) {
      return null;
    }
  }

  private mapTaskStatus(status: string): task.TaskStatus {
    switch (status) {
      case 'idle':
        return 'IDLE';
      case 'running':
        return 'RUNNING';
      case 'finished':
        return 'FINISHED';
      case 'error':
        return 'ERROR';
      case 'killed':
        return 'KILLED';
      default:
        return 'IDLE';
    }
  }

  dispose(): void {
    this._onTaskUpdate.dispose();
  }
}

class PintAgentClientSystem implements IAgentClientSystem {
  private _onInitStatusUpdate = new Emitter<system.InitStatus>();

  constructor(private client: any) {}

  get onInitStatusUpdate(): Event<system.InitStatus> {
    return this._onInitStatusUpdate.event;
  }

  async update(): Promise<Record<string, undefined>> {
    // Pint API doesn't have system update endpoint
    return {};
  }

  dispose(): void {
    this._onInitStatusUpdate.dispose();
  }
}