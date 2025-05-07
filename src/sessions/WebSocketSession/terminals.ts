import type { protocol, IPitcherClient } from "@codesandbox/pitcher-client";
import type { Id } from "@codesandbox/pitcher-common";
import { Disposable } from "../../utils/disposable";
import { Emitter } from "../../utils/event";

export type ShellSize = { cols: number; rows: number };

export const DEFAULT_SHELL_SIZE: ShellSize = { cols: 128, rows: 24 };

export class Terminals {
  private disposable = new Disposable();
  constructor(
    sessionDisposable: Disposable,
    private pitcherClient: IPitcherClient
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  async create(
    shellType: "bash" | "zsh" | "fish" | "ksh" | "dash" = "bash",
    dimensions = DEFAULT_SHELL_SIZE
  ): Promise<Terminal> {
    const shell = await this.pitcherClient.clients.shell.create(
      this.pitcherClient.workspacePath,
      dimensions,
      shellType,
      "TERMINAL",
      true
    );

    return new Terminal(shell, this.pitcherClient);
  }

  /**
   * Opens an existing terminal.
   */
  async open(
    shellId: string,
    dimensions = DEFAULT_SHELL_SIZE
  ): Promise<Terminal> {
    const shell = await this.pitcherClient.clients.shell.open(
      shellId as Id,
      dimensions
    );
    return new Terminal(shell, this.pitcherClient);
  }

  /**
   * Gets all terminals running in the current sandbox
   */
  getAll() {
    const shells = this.pitcherClient.clients.shell.getShells();

    return shells
      .filter((shell) => shell.shellType === "TERMINAL")
      .map((shell) => new Terminal(shell, this.pitcherClient));
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
    private pitcherClient: IPitcherClient
  ) {
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

  async write(input: string, dimensions = DEFAULT_SHELL_SIZE): Promise<void> {
    await this.pitcherClient.clients.shell.send(
      this.shell.shellId,
      input,
      dimensions
    );
  }

  async run(input: string, dimensions = DEFAULT_SHELL_SIZE): Promise<void> {
    return this.write(input + "\n", dimensions);
  }

  // TODO: allow for kill signals
  async kill(): Promise<void> {
    this.disposable.dispose();
    await this.pitcherClient.clients.shell.delete(this.shell.shellId);
  }
}
