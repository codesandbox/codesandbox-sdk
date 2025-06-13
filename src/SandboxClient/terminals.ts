import * as protocol from "../pitcher-protocol";
import { Disposable } from "../utils/disposable";
import { Emitter } from "../utils/event";
import { isCommandShell, ShellRunOpts } from "./commands";
import { IAgentClient } from "../node/agent-client-interface";

export type ShellSize = { cols: number; rows: number };

export const DEFAULT_SHELL_SIZE: ShellSize = { cols: 128, rows: 24 };

export class Terminals {
  private disposable = new Disposable();
  constructor(
    sessionDisposable: Disposable,
    private agentClient: IAgentClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  async create(
    command: "bash" | "zsh" | "fish" | "ksh" | "dash" = "bash",
    opts?: ShellRunOpts
  ): Promise<Terminal> {
    const allEnv = Object.assign(opts?.env ?? {});

    // TODO: use a new shell API that natively supports cwd & env
    let commandWithEnv = Object.keys(allEnv).length
      ? `source $HOME/.private/.env 2>/dev/null || true && env ${Object.entries(
          allEnv
        )
          .map(([key, value]) => `${key}=${value}`)
          .join(" ")} ${command}`
      : `source $HOME/.private/.env 2>/dev/null || true && ${command}`;

    if (opts?.cwd) {
      commandWithEnv = `cd ${opts.cwd} && ${commandWithEnv}`;
    }

    const shell = await this.agentClient.shells.create(
      this.agentClient.workspacePath,
      opts?.dimensions ?? DEFAULT_SHELL_SIZE,
      commandWithEnv,
      "TERMINAL",
      true
    );

    if (opts?.name) {
      this.agentClient.shells.rename(shell.shellId, opts.name);
    }

    return new Terminal(shell, this.agentClient);
  }

  async get(shellId: string) {
    const shells = await this.agentClient.shells.getShells();

    const shell = shells.find((shell) => shell.shellId === shellId);

    if (!shell) {
      return;
    }

    return new Terminal(shell, this.agentClient);
  }

  /**
   * Gets all terminals running in the current sandbox
   */
  async getAll() {
    const shells = await this.agentClient.shells.getShells();

    return shells
      .filter(
        (shell) => shell.shellType === "TERMINAL" && !isCommandShell(shell)
      )
      .map((shell) => new Terminal(shell, this.agentClient));
  }
}

export class Terminal {
  private disposable = new Disposable();
  // TODO: differentiate between stdout and stderr, also send back bytes instead of
  // strings
  private onOutputEmitter = this.disposable.addDisposable(
    new Emitter<string>()
  );
  public readonly onOutput = this.onOutputEmitter.event;
  private output = this.shell.buffer || [];

  /**
   * Gets the ID of the terminal. Can be used to open it again.
   */
  get id(): string {
    return this.shell.shellId as string;
  }

  /**
   * Gets the name of the terminal.
   */
  get name(): string {
    return this.shell.name;
  }

  constructor(
    private shell: protocol.shell.ShellDTO & { buffer?: string[] },
    private agentClient: IAgentClient
  ) {
    this.disposable.addDisposable(
      this.agentClient.shells.onShellOut(({ shellId, out }) => {
        if (shellId === this.shell.shellId) {
          this.onOutputEmitter.fire(out);

          this.output.push(out);
          if (this.output.length > 1000) {
            this.output.shift();
          }
        }
      })
    );
  }

  /**
   * Open the terminal and get its current output, subscribes to future output
   */
  async open(dimensions = DEFAULT_SHELL_SIZE): Promise<string> {
    const shell = await this.agentClient.shells.open(
      this.shell.shellId,
      dimensions
    );

    this.output = shell.buffer;

    return this.output.join("\n");
  }

  async write(input: string, dimensions = DEFAULT_SHELL_SIZE): Promise<void> {
    await this.agentClient.shells.send(this.shell.shellId, input, dimensions);
  }

  async run(input: string, dimensions = DEFAULT_SHELL_SIZE): Promise<void> {
    return this.write(input + "\n", dimensions);
  }

  // TODO: allow for kill signals
  async kill(): Promise<void> {
    this.disposable.dispose();
    await this.agentClient.shells.delete(this.shell.shellId);
  }
}
