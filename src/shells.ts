import type { protocol, IPitcherClient } from "@codesandbox/pitcher-client";
import type { Id } from "@codesandbox/pitcher-common";
import { Barrier, DisposableStore } from "@codesandbox/pitcher-common";
import type { OpenShellDTO } from "@codesandbox/pitcher-protocol/dist/src/messages/shell";

import { Disposable } from "./utils/disposable";
import { Emitter, type Event } from "./utils/event";

export interface RunningCommand
  extends Promise<{ output: string; exitCode?: number }> {
  onOutput: Event<string>;
  kill(): void;
}

export type ShellCreateOpts = {
  ptySize?: ShellSize;
};
export type ShellRunOpts = {
  ptySize?: ShellSize;
  shellName?: string;
  env?: Record<string, string>;
  cwd?: string;
};
export type ShellOpenOpts = {
  ptySize?: ShellSize;
};
export type ShellSize = { cols: number; rows: number };
export type ShellStatus =
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "KILLED"
  | "RESTARTING";
export const DEFAULT_SHELL_SIZE: ShellSize = { cols: 128, rows: 24 };

export class Shells extends Disposable {
  constructor(private pitcherClient: IPitcherClient) {
    super();
  }

  public readonly js = new LanguageInterpreter(this.pitcherClient, {
    runtime: "node",
    extension: "js",
    env: { NO_COLOR: "true" },
  });
  public readonly python = new LanguageInterpreter(this.pitcherClient, {
    runtime: "python",
    extension: "py",
    env: {},
  });

  /**
   * Creates a shell that can run commands, will return output as data is sent to stdin.
   *
   * ## Example
   *
   * ```ts
   * const shell = await sandbox.shell.create();
   *
   * const disposable = shell.onShellOut((data) => {
   *   console.log(data);
   * });
   *
   * // Write to the shell
   * shell.write("echo 'Hello, world!'");
   *
   * // Stop listening to the shell
   * disposable.dispose();
   *
   * // Kill the shell
   * await shell.kill();
   * ```
   *
   * @param command - The command to run in the shell.
   * @param shellSize - The size of the shell.
   * @returns A disposable shell instance.
   */
  async create(
    command = "bash",
    opts?: ShellCreateOpts
  ): Promise<ShellInstance> {
    const shell = await this.pitcherClient.clients.shell.create(
      this.pitcherClient.workspacePath,
      opts?.ptySize ?? DEFAULT_SHELL_SIZE,
      command,
      "TERMINAL",
      true
    );

    return new ShellInstance(shell, this.pitcherClient);
  }

  /**
   * Opens an existing shell.
   */
  async open(shellId: string, opts?: ShellOpenOpts): Promise<ShellInstance> {
    const shell = await this.pitcherClient.clients.shell.open(
      shellId as Id,
      opts?.ptySize ?? DEFAULT_SHELL_SIZE
    );
    return new ShellInstance(shell, this.pitcherClient);
  }

  /**
   * Runs the given command, and can be listened to for streaming output. To get all
   * output, you can optionally await the returned promise.
   *
   * ## Example
   *
   * ```ts
   * const shell = await sandbox.shell.runCommand("echo 'Hello, world!'");
   *
   * shell.onOutput((data) => {
   *   console.log(data);
   * });
   *
   * const result = await shell;
   *
   * console.log(result.output, result.exitCode);
   * ```
   */
  run(command: string, opts?: ShellRunOpts): RunningCommand {
    const shell = runCommandAsUser(
      this.pitcherClient,
      command,
      opts?.ptySize ?? DEFAULT_SHELL_SIZE,
      undefined,
      opts?.env,
      opts?.shellName,
      opts?.cwd
    );

    return shell;
  }

  /**
   * Gets all shells that are running or have ran before in the current sandbox.
   */
  async getShells(): Promise<ShellInstance[]> {
    const shells = this.pitcherClient.clients.shell.getShells();

    return shells.map((shell) => new ShellInstance(shell, this.pitcherClient));
  }
}

interface ILanguageInterpreterOpts {
  runtime: string;
  extension: string;
  env: Record<string, string>;
}

function getRandomString() {
  return Math.random().toString(36).substring(7);
}

class LanguageInterpreter {
  constructor(
    private pitcherClient: IPitcherClient,
    private opts: ILanguageInterpreterOpts
  ) {}

  async run(code: string): Promise<RunningCommand> {
    const randomString = getRandomString();
    const tmpFileName = `/tmp/tmp.${randomString}.${this.opts.extension}`;

    const command = `${this.opts.runtime} ${tmpFileName}`;

    const result = runCommandAsUser(
      this.pitcherClient,
      command,
      DEFAULT_SHELL_SIZE,
      async () => {
        const tmpFile = await this.pitcherClient.clients.fs.writeFile(
          tmpFileName,
          new TextEncoder().encode(code),
          true,
          true
        );

        if (tmpFile.type === "error") {
          throw new Error(`${tmpFile.errno}: ${tmpFile.error}`);
        }
      },
      this.opts.env
    );

    return result;
  }
}

class ShellInstance extends Disposable {
  // TODO: differentiate between stdout and stderr, also send back bytes instead of
  // strings
  private onShellOutputEmitter = this.addDisposable(new Emitter<string>());
  public readonly onOutput = this.onShellOutputEmitter.event;

  private onShellUpdatedEmitter = this.addDisposable(new Emitter<void>());
  public readonly onShellUpdated = this.onShellUpdatedEmitter.event;

  private output = this.shell.buffer || [];

  constructor(
    private shell: protocol.shell.ShellDTO & { buffer?: string[] },
    private pitcherClient: IPitcherClient
  ) {
    super();

    this.addDisposable(
      pitcherClient.clients.shell.onShellsUpdated((shells) => {
        const updatedShell = shells.find(
          (s) => s.shellId === this.shell.shellId
        );
        if (updatedShell) {
          this.shell = { ...updatedShell, buffer: [] };
          this.onShellUpdatedEmitter.fire();
        }
      })
    );

    this.addDisposable(
      this.pitcherClient.clients.shell.onShellOut(({ shellId, out }) => {
        if (shellId === this.shell.shellId) {
          this.onShellOutputEmitter.fire(out);

          this.output.push(out);
          if (this.output.length > 1000) {
            this.output.shift();
          }
        }
      })
    );

    this.onWillDispose(async () => {
      try {
        await this.pitcherClient.clients.shell.close(this.shell.shellId);
      } catch (e) {
        // Ignore errors, we don't care if it's already closed or if we disconnected
      }
    });
  }

  /**
   * Gets the ID of the shell. Can be used to open the shell again.
   */
  get id(): string {
    return this.shell.shellId as string;
  }

  /**
   * Gets the name of the shell.
   */
  get name(): string {
    return this.shell.name;
  }

  get exitCode(): number | undefined {
    return this.shell.exitCode;
  }

  /**
   * Gets the status of the shell.
   */
  get status(): ShellStatus {
    return this.shell.status;
  }

  async write(input: string): Promise<void> {
    await this.pitcherClient.clients.shell.send(this.shell.shellId, input, {
      cols: 80,
      rows: 24,
    });
  }

  // TODO: allow for kill signals
  async kill(): Promise<void> {
    await this.pitcherClient.clients.shell.delete(this.shell.shellId);
  }

  /**
   * @returns The total output of the shell
   */
  getOutput(): string {
    return this.output.join("\n");
  }
}

function runCommandAsUser(
  pitcher: IPitcherClient,
  command: string,
  shellSize: ShellSize = DEFAULT_SHELL_SIZE,
  runPreCommand?: () => Promise<void>,
  env?: Record<string, string>,
  shellName?: string,
  cwd?: string
): RunningCommand {
  const disposableStore = new DisposableStore();
  const onOutput = new Emitter<string>();
  disposableStore.add(onOutput);

  let shell: OpenShellDTO;

  const resultPromise = (async () => {
    if (runPreCommand) {
      await runPreCommand();
    }

    // TODO: use a new shell API that natively supports cwd & env
    let commandWithEnv = Object.keys(env ?? {}).length
      ? `env ${Object.entries(env ?? {})
          .map(([key, value]) => `${key}=${value}`)
          .join(" ")} ${command}`
      : command;

    if (cwd) {
      commandWithEnv = `cd ${cwd} && ${commandWithEnv}`;
    }

    shell = await pitcher.clients.shell.create(
      pitcher.workspacePath,
      shellSize,
      commandWithEnv,
      "TERMINAL",
      true
    );

    if (shellName) {
      pitcher.clients.shell.rename(shell.shellId, shellName);
    }

    if (shell.status === "FINISHED") {
      return {
        output: shell.buffer.join("\n").trim(),
        exitCode: shell.exitCode,
      };
    }

    let combinedOut = shell.buffer.join("\n");
    if (combinedOut) {
      onOutput.fire(combinedOut);
    }
    const barrier = new Barrier<{ exitCode?: number }>();

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

        barrier.open({ exitCode });
      })
    );

    disposableStore.add(
      pitcher.clients.shell.onShellTerminated(({ shellId }) => {
        if (shellId !== shell.shellId) {
          return;
        }

        barrier.open({ exitCode: undefined });
      })
    );

    const result = await barrier.wait();
    disposableStore.dispose();

    if (result.status === "disposed") {
      throw new Error("Shell was disposed");
    }

    return {
      output: combinedOut.trim(),
      exitCode: result.value.exitCode,
    };
  })() as RunningCommand;

  resultPromise.kill = () => {
    disposableStore.dispose();

    if (shell) {
      pitcher.clients.shell.delete(shell.shellId);
    }
  };
  resultPromise.onOutput = onOutput.event;

  return resultPromise as RunningCommand;
}
