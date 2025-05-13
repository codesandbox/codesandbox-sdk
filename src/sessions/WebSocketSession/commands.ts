import type { protocol, IPitcherClient } from "@codesandbox/pitcher-client";
import { Barrier, DisposableStore } from "@codesandbox/pitcher-common";
import { Disposable } from "../../utils/disposable";
import { Emitter, type Event } from "../../utils/event";

export interface RunningCommand
  extends Promise<{ output: string; exitCode?: number }> {
  onOutput: Event<string>;
  kill(): void;
}

type ShellSize = { cols: number; rows: number };

export type ShellRunOpts = {
  dimensions?: ShellSize;
  name?: string;
  env?: Record<string, string>;
  cwd?: string;
};

export type CommandStatus =
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "KILLED"
  | "RESTARTING";

const DEFAULT_SHELL_SIZE = { cols: 128, rows: 24 };

export class Commands {
  private disposable = new Disposable();
  constructor(
    sessionDisposable: Disposable,
    private pitcherClient: IPitcherClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  async create(command: string, opts?: ShellRunOpts) {
    const disposableStore = new DisposableStore();
    const onOutput = new Emitter<string>();
    disposableStore.add(onOutput);

    // TODO: use a new shell API that natively supports cwd & env
    let commandWithEnv = Object.keys(opts?.env ?? {}).length
      ? `env ${Object.entries(opts?.env ?? {})
          .map(([key, value]) => `${key}=${value}`)
          .join(" ")} ${command}`
      : command;

    if (opts?.cwd) {
      commandWithEnv = `cd ${opts.cwd} && ${commandWithEnv}`;
    }

    const shell = await this.pitcherClient.clients.shell.create(
      this.pitcherClient.workspacePath,
      opts?.dimensions ?? DEFAULT_SHELL_SIZE,
      commandWithEnv,
      "COMMAND",
      true
    );

    if (opts?.name) {
      this.pitcherClient.clients.shell.rename(shell.shellId, opts.name);
    }

    const cmd = new Command(
      this.pitcherClient,
      shell as protocol.shell.CommandShellDTO
    );

    return cmd;
  }

  async run(command: string | string[], opts?: ShellRunOpts): Promise<string> {
    const cmd = await this.create(
      Array.isArray(command) ? command.join(" && ") : command,
      opts
    );

    return cmd.getOutput();
  }

  getAll(): Command[] {
    const shells = this.pitcherClient.clients.shell.getShells();

    return shells
      .filter((shell) => shell.shellType === "COMMAND")
      .map((shell) => new Command(this.pitcherClient, shell));
  }
}

export class Command {
  private disposable = new Disposable();
  // TODO: differentiate between stdout and stderr, also send back bytes instead of
  // strings
  private onOutputEmitter = this.disposable.addDisposable(
    new Emitter<string>()
  );
  public readonly onOutput = this.onOutputEmitter.event;

  private onStatusChangeEmitter = this.disposable.addDisposable(
    new Emitter<CommandStatus>()
  );
  public readonly onStatusChange = this.onStatusChangeEmitter.event;
  private barrier = new Barrier<void>();

  private output: string[] = [];

  get id(): string {
    return this.shell.shellId as string;
  }

  get command(): string {
    return this.shell.startCommand;
  }

  status: CommandStatus = "RUNNING";

  constructor(
    private pitcherClient: IPitcherClient,
    private shell: protocol.shell.CommandShellDTO & { buffer?: string[] }
  ) {
    this.disposable.addDisposable(
      pitcherClient.clients.shell.onShellExited(({ shellId, exitCode }) => {
        if (shellId === this.id) {
          this.status = exitCode === 0 ? "FINISHED" : "ERROR";
          this.barrier.open();
          this.kill();
        }
      })
    );

    this.disposable.addDisposable(
      pitcherClient.clients.shell.onShellTerminated(({ shellId }) => {
        if (shellId === this.id) {
          this.status = "KILLED";
          this.barrier.open();
          this.kill();
        }
      })
    );

    this.disposable.addDisposable(
      this.pitcherClient.clients.shell.onShellOut(({ shellId, out }) => {
        if (shellId !== this.shell.shellId || out.startsWith("[CODESANDBOX]")) {
          return;
        }

        this.onOutputEmitter.fire(out);

        this.output.push(out);
        if (this.output.length > 1000) {
          this.output.shift();
        }
      })
    );
  }

  async getOutput(): Promise<string> {
    await this.barrier.wait();

    if (this.status === "FINISHED") {
      return this.output.join("\n");
    }

    throw new Error(`Command ERROR: ${this.output.join("\n")}`);
  }

  // TODO: allow for kill signals
  async kill(): Promise<void> {
    this.disposable.dispose();
    await this.pitcherClient.clients.shell.delete(this.shell.shellId);
  }

  async restart(): Promise<void> {
    if (this.status !== "RUNNING") {
      throw new Error("Command is not running");
    }

    await this.pitcherClient.clients.shell.restart(this.shell.shellId);
  }
}
