import * as protocol from "../pitcher-protocol";
import { Disposable } from "../utils/disposable";
import { Emitter } from "../utils/event";
import { isCommandShell, ShellRunOpts } from "./commands";
import { type IAgentClient } from "../agent-client-interface";
import { Tracer, SpanStatusCode } from "@opentelemetry/api";
import { Barrier } from "../utils/barrier";

export type ShellSize = { cols: number; rows: number };

export const DEFAULT_SHELL_SIZE: ShellSize = { cols: 128, rows: 24 };

export class Terminals {
  private disposable = new Disposable();
  private tracer?: Tracer;

  constructor(
    sessionDisposable: Disposable,
    private agentClient: IAgentClient,
    tracer?: Tracer
  ) {
    this.tracer = tracer;
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  private async withSpan<T>(
    operationName: string,
    attributes: Record<string, string | number | boolean> = {},
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.tracer) {
      return operation();
    }

    return this.tracer.startActiveSpan(
      operationName,
      { attributes },
      async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  async create(
    command: "bash" | "zsh" | "fish" | "ksh" | "dash" = "bash",
    opts?: ShellRunOpts
  ): Promise<Terminal> {
    return this.withSpan(
      "terminals.create",
      {
        command,
        cwd: opts?.cwd ?? "",
        name: opts?.name ?? "",
        envCount: Object.keys(opts?.env ?? {}).length,
        hasDimensions: !!opts?.dimensions,
      },
      async () => {
        const passedEnv = Object.assign(opts?.env ?? {});

        // Build bash args array
        const args = ["source $HOME/.private/.env 2>/dev/null || true"];

        if (Object.keys(passedEnv).length) {
          Object.entries(passedEnv).forEach(([key, value]) => {
            args.push("&&", "env", `${key}=${value}`);
          });
        }

        if (opts?.cwd) {
          args.push("&&", "cd", opts.cwd);
        }

        const shell = await this.agentClient.shells.create({
          projectPath: this.agentClient.workspacePath,
          size: opts?.dimensions ?? DEFAULT_SHELL_SIZE,
          command,
          args: [],
          type: "TERMINAL",
          isSystemShell: true,
        });

        if (opts?.name) {
          this.agentClient.shells.rename(shell.shellId, opts.name);
        }

        const terminal = new Terminal(shell, this.agentClient, this.tracer);

        await terminal.write(args.join(" ") + "\n");

        return terminal;
      }
    );
  }

  async get(shellId: string) {
    return this.withSpan("terminals.get", { shellId }, async () => {
      const shells = await this.agentClient.shells.getShells();

      const shell = shells.find((shell) => shell.shellId === shellId);

      if (!shell) {
        return;
      }

      return new Terminal(shell, this.agentClient, this.tracer);
    });
  }

  /**
   * Gets all terminals running in the current sandbox
   */
  async getAll() {
    return this.withSpan("terminals.getAll", {}, async () => {
      const shells = await this.agentClient.shells.getShells();

      return shells
        .filter(
          (shell) => shell.shellType === "TERMINAL" && !isCommandShell(shell)
        )
        .map((shell) => new Terminal(shell, this.agentClient, this.tracer));
    });
  }
}

export class Terminal {
  private disposable = new Disposable();
  private tracer?: Tracer;
  // TODO: differentiate between stdout and stderr, also send back bytes instead of
  // strings
  private onOutputEmitter = this.disposable.addDisposable(
    new Emitter<string>()
  );
  public readonly onOutput = this.onOutputEmitter.event;
  private output = this.shell.buffer || [];
  private isSubscribingOutput = false;

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
    private agentClient: IAgentClient,
    tracer?: Tracer
  ) {
    this.tracer = tracer;
  }

  private async withSpan<T>(
    operationName: string,
    attributes: Record<string, string | number | boolean> = {},
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.tracer) {
      return operation();
    }

    return this.tracer.startActiveSpan(
      operationName,
      { attributes },
      async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Open the terminal and get its current output, subscribes to future output
   */
  async open(dimensions = DEFAULT_SHELL_SIZE): Promise<string> {
    return this.withSpan(
      "terminal.open",
      {
        shellId: this.shell.shellId,
        cols: dimensions.cols,
        rows: dimensions.rows,
      },
      async () => {
        if (this.isSubscribingOutput) {
          return this.output.join("\n");
        }

        const barrier = new Barrier<string>();

        this.disposable.addDisposable(
          this.agentClient.shells.subscribeOutput(
            this.shell.shellId,
            dimensions,
            ({ out }) => {
              if (barrier.isOpen()) {
                this.onOutputEmitter.fire(out);

                this.output.push(out);
                if (this.output.length > 1000) {
                  this.output.shift();
                }
              } else {
                this.output.push(out);
                barrier.open(out);
              }
            }
          )
        );

        this.disposable.onDidDispose(() => {
          barrier.dispose();
        });

        const result = await barrier.wait();

        // This will never really happen
        if (result.status === "disposed") {
          return "";
        }

        return result.value;
      }
    );
  }

  async write(input: string, dimensions = DEFAULT_SHELL_SIZE): Promise<void> {
    return this.withSpan(
      "terminal.write",
      {
        shellId: this.shell.shellId,
        inputLength: input.length,
        cols: dimensions.cols,
        rows: dimensions.rows,
      },
      async () => {
        await this.agentClient.shells.send(
          this.shell.shellId,
          input,
          dimensions
        );
      }
    );
  }

  async run(input: string, dimensions = DEFAULT_SHELL_SIZE): Promise<void> {
    return this.withSpan(
      "terminal.run",
      {
        shellId: this.shell.shellId,
        command: input,
        cols: dimensions.cols,
        rows: dimensions.rows,
      },
      async () => {
        return this.write(input + "\n", dimensions);
      }
    );
  }

  // TODO: allow for kill signals
  async kill(): Promise<void> {
    return this.withSpan(
      "terminal.kill",
      {
        shellId: this.shell.shellId,
      },
      async () => {
        this.disposable.dispose();
        await this.agentClient.shells.delete(this.shell.shellId);
      }
    );
  }
}
