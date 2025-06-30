import { IPitcherClient } from "@codesandbox/pitcher-client";
import {
  IAgentClient,
  IAgentClientFS,
  IAgentClientPorts,
  IAgentClientSetup,
  IAgentClientShells,
  IAgentClientState,
  IAgentClientSystem,
  IAgentClientTasks,
} from "../node/agent-client-interface";
import { Emitter } from "../utils/event";

class BrowserAgentClientShells implements IAgentClientShells {
  onShellExited = this.pitcherClient.clients.shell.onShellExited;
  onShellTerminated = this.pitcherClient.clients.shell.onShellTerminated;
  onShellOut = this.pitcherClient.clients.shell.onShellOut;
  constructor(private pitcherClient: IPitcherClient) {}
  create(...params: Parameters<IAgentClientShells["create"]>) {
    return this.pitcherClient.clients.shell.create(...params);
  }
  rename(...params: Parameters<IAgentClientShells["rename"]>) {
    return this.pitcherClient.clients.shell.rename(...params);
  }
  async getShells() {
    return this.pitcherClient.clients.shell.getShells();
  }
  open(...params: Parameters<IAgentClientShells["open"]>) {
    return this.pitcherClient.clients.shell.open(...params);
  }
  delete(...params: Parameters<IAgentClientShells["delete"]>) {
    return this.pitcherClient.clients.shell.delete(...params);
  }
  restart(...params: Parameters<IAgentClientShells["restart"]>) {
    return this.pitcherClient.clients.shell.restart(...params);
  }
  send(...params: Parameters<IAgentClientShells["send"]>) {
    return this.pitcherClient.clients.shell.send(...params);
  }
}

class BrowserAgentClientFS implements IAgentClientFS {
  constructor(private pitcherClient: IPitcherClient) {}
  copy(...params: Parameters<IAgentClientFS["copy"]>) {
    return this.pitcherClient.clients.fs.copy(...params);
  }
  mkdir(...params: Parameters<IAgentClientFS["mkdir"]>) {
    return this.pitcherClient.clients.fs.mkdir(...params);
  }
  readdir(...params: Parameters<IAgentClientFS["readdir"]>) {
    return this.pitcherClient.clients.fs.readdir(...params);
  }
  readFile(...params: Parameters<IAgentClientFS["readFile"]>) {
    return this.pitcherClient.clients.fs.readFile(...params);
  }
  stat(...params: Parameters<IAgentClientFS["stat"]>) {
    return this.pitcherClient.clients.fs.stat(...params);
  }
  remove(...params: Parameters<IAgentClientFS["remove"]>) {
    return this.pitcherClient.clients.fs.remove(...params);
  }
  rename(...params: Parameters<IAgentClientFS["rename"]>) {
    return this.pitcherClient.clients.fs.rename(...params);
  }
  watch(...params: Parameters<IAgentClientFS["watch"]>) {
    return this.pitcherClient.clients.fs.watch(...params);
  }
  writeFile(...params: Parameters<IAgentClientFS["writeFile"]>) {
    return this.pitcherClient.clients.fs.writeFile(...params);
  }
  download(...params: Parameters<IAgentClientFS["download"]>) {
    return this.pitcherClient.clients.fs.download(...params);
  }
}

class BrowserAgentClientPorts implements IAgentClientPorts {
  onPortsUpdated = this.pitcherClient.clients.port.onPortsUpdated;
  async getPorts() {
    return this.pitcherClient.clients.port.getPorts();
  }
  constructor(private pitcherClient: IPitcherClient) {}
}

class BrowserAgentClientSetup implements IAgentClientSetup {
  onSetupProgressUpdate =
    this.pitcherClient.clients.setup.onSetupProgressUpdate;
  constructor(private pitcherClient: IPitcherClient) {}
  init() {
    return this.pitcherClient.clients.setup.init();
  }
  async getProgress() {
    return this.pitcherClient.clients.setup.getProgress();
  }
}

class BrowserAgentClientTasks implements IAgentClientTasks {
  onTaskUpdate = this.pitcherClient.clients.task.onTaskUpdate;
  constructor(private pitcherClient: IPitcherClient) {}
  async getTasks() {
    return this.pitcherClient.clients.task.getTasks();
  }
  async getTask(taskId: string) {
    return this.pitcherClient.clients.task.getTask(taskId);
  }
  runTask(taskId: string) {
    return this.pitcherClient.clients.task.runTask(taskId);
  }
  stopTask(taskId: string) {
    return this.pitcherClient.clients.task.stopTask(taskId);
  }
}

class BrowserAgentClientSystem implements IAgentClientSystem {
  constructor(private pitcherClient: IPitcherClient) {}
  update() {
    return this.pitcherClient.clients.system.update();
  }
}

export class BrowserAgentClient implements IAgentClient {
  sandboxId = this.pitcherClient.instanceId;
  workspacePath = this.pitcherClient.instanceId;
  isUpToDate = this.pitcherClient.isUpToDate();
  state = this.pitcherClient.state.get().state;
  private onStateChangeEmitter = new Emitter<IAgentClientState>();
  onStateChange = this.onStateChangeEmitter.event;
  shells = new BrowserAgentClientShells(this.pitcherClient);
  fs = new BrowserAgentClientFS(this.pitcherClient);
  ports = new BrowserAgentClientPorts(this.pitcherClient);
  setup = new BrowserAgentClientSetup(this.pitcherClient);
  tasks = new BrowserAgentClientTasks(this.pitcherClient);
  system = new BrowserAgentClientSystem(this.pitcherClient);
  constructor(private pitcherClient: IPitcherClient) {
    pitcherClient.onStateChange((state) => {
      this.state = state.state;
      this.onStateChangeEmitter.fire(state.state);
    });
  }
  disconnect(): Promise<void> {
    return this.pitcherClient.disconnect();
  }
  reconnect(): Promise<void> {
    return this.pitcherClient.reconnect();
  }
  dispose() {
    this.pitcherClient.dispose();
  }
}
