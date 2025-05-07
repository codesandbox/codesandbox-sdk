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

  async run(command: string, opts?: ShellRunOpts): Promise<Command> {
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

    return new Command(this.pitcherClient, shell);
  }

  async getAll(): Promise<Command[]> {
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
  private outputPromise: Promise<{ output: string; status: CommandStatus }>;

  private output = this.shell.buffer || [];

  get id(): string {
    return this.shell.shellId as string;
  }

  get name(): string {
    return this.shell.name;
  }

  get status(): CommandStatus {
    return this.shell.status;
  }

  constructor(
    private pitcherClient: IPitcherClient,
    private shell: protocol.shell.ShellDTO & { buffer?: string[] }
  ) {
    this.outputPromise = createCommandOutputPromise(pitcherClient, shell);
    this.disposable.addDisposable(
      pitcherClient.clients.shell.onShellsUpdated((shells) => {
        const updatedShell = shells.find(
          (s) => s.shellId === this.shell.shellId
        );
        if (updatedShell) {
          this.shell = { ...updatedShell, buffer: [] };
          this.onStatusChangeEmitter.fire(updatedShell.status);
        }
      })
    );

    this.disposable.addDisposable(
      this.pitcherClient.clients.shell.onShellOut(({ shellId, out }) => {
        if (shellId === this.shell.shellId) {
          this.onOutputEmitter.fire(out);

          this.output.push(out);
          if (this.output.length > 1000) {
            this.output.shift();
          }
        }
      })
    );

    this.disposable.onWillDispose(async () => {
      try {
        await this.pitcherClient.clients.shell.delete(this.shell.shellId);
      } catch (e) {
        // Ignore errors, we don't care if it's already closed or if we disconnected
      }
    });
  }

  getOutput(): string {
    return this.output.join("\n");
  }

  async getFinalOutput() {
    return this.outputPromise;
  }

  // TODO: allow for kill signals
  async kill(): Promise<void> {
    this.disposable.dispose();
    await this.pitcherClient.clients.shell.delete(this.shell.shellId);
  }

  async restart(): Promise<void> {
    await this.pitcherClient.clients.shell.restart(this.shell.shellId);
  }
}

async function createCommandOutputPromise(
  pitcher: IPitcherClient,
  shell: protocol.shell.ShellDTO & { buffer?: string[] }
): Promise<{ output: string; status: CommandStatus }> {
  const disposableStore = new DisposableStore();
  const onOutput = new Emitter<string>();

  disposableStore.add(onOutput);

  if (shell.status === "FINISHED") {
    return {
      output: shell.buffer?.join("\n").trim() ?? "",
      status: shell.status,
    };
  }

  let combinedOut = shell.buffer?.join("\n") ?? "";
  if (combinedOut) {
    onOutput.fire(combinedOut);
  }
  const barrier = new Barrier<CommandStatus>();

  disposableStore.add(
    pitcher.clients.shell.onShellOut(({ shellId, out }) => {
      if (shellId !== shell.shellId) {
        return;
      }

      onOutput.fire(out);
      combinedOut += out;
    })
  );

  disposableStore.add(
    pitcher.clients.shell.onShellExited(({ shellId, exitCode }) => {
      if (shellId !== shell.shellId) {
        return;
      }

      barrier.open(exitCode === 0 ? "FINISHED" : "ERROR");
    })
  );

  disposableStore.add(
    pitcher.clients.shell.onShellTerminated(({ shellId }) => {
      if (shellId !== shell.shellId) {
        return;
      }

      barrier.open("KILLED");
    })
  );

  const result = await barrier.wait();
  disposableStore.dispose();

  if (result.status === "disposed") {
    throw new Error("Shell was disposed");
  }

  return {
    output: combinedOut.trim(),
    status: result.value,
  };
}
