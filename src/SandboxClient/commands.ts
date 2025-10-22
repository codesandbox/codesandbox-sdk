import { Disposable, DisposableStore } from "../utils/disposable";
import { Emitter } from "../utils/event";
import { IAgentClient } from "../agent-client-interface";
import * as protocol from "../pitcher-protocol";
import { Barrier } from "../utils/barrier";
import { Tracer, SpanStatusCode } from "@opentelemetry/api";

type ShellSize = { cols: number; rows: number };

export type ShellRunOpts = {
  dimensions?: ShellSize;
  name?: string;
  env?: Record<string, string>;
  cwd?: string;
  /**
   * Run the command in the global session instead of the current session. This makes
   * any environment variables available to all users of the Sandbox.
   */
  asGlobalSession?: boolean;
};

export type CommandStatus =
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "KILLED"
  | "RESTARTING";

const DEFAULT_SHELL_SIZE = { cols: 128, rows: 24 };

// This can not be called Commands due to React Native
export class SandboxCommands {
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

  /**
   * Create and run command in a new shell. Allows you to listen to the output and kill the command.
   */
  async runBackground(command: string | string[], opts?: ShellRunOpts) {
    const cmdString = Array.isArray(command) ? command.join(" && ") : command;
    return this.withSpan(
      "commands.runBackground",
      {
        "command.text": cmdString,
        "command.cwd": opts?.cwd || "/project",
        "command.asGlobalSession": opts?.asGlobalSession || false,
        "command.name": opts?.name || "",
      },
      async () => {
        command = Array.isArray(command) ? command.join(" && ") : command;

        const passedEnv = Object.assign(opts?.env ?? {});

        // Build bash args array
        const args = ["-c", "source $HOME/.private/.env 2>/dev/null || true"];

        if (Object.keys(passedEnv).length) {
          Object.entries(passedEnv).forEach(([key, value]) => {
            args.push("&&", "env", `${key}=${value}`);
          });
        }

        if (opts?.cwd) {
          args.push("&&", "cd", opts.cwd);
        }

        args.push("&&", command);

        const shell = await this.agentClient.shells.create({
          command: "bash",
          args,
          projectPath: this.agentClient.workspacePath,
          size: opts?.dimensions ?? DEFAULT_SHELL_SIZE,
          type: opts?.asGlobalSession ? "COMMAND" : "TERMINAL",
          isSystemShell: true,
        });

        if (shell.status === "ERROR" || shell.status === "KILLED") {
          throw new Error(`Failed to create shell: ${shell.buffer.join("\n")}`);
        }

        const details = {
          type: "command",
          command,
          name: opts?.name,
        };

        if (shell.status !== "FINISHED") {
          // Only way for us to differentiate between a command and a terminal
          this.agentClient.shells
            .rename(
              shell.shellId,
              // We embed some details in the name to properly show the command that was run
              // , the name and that it is an actual command
              JSON.stringify(details)
            )
            .catch(() => {
              // It is already done
            });
        }

        const cmd = new Command(
          this.agentClient,
          shell as protocol.shell.CommandShellDTO,
          details,
          this.tracer
        );

        return cmd;
      }
    );
  }

  /**
   * Run a command in a new shell and wait for it to finish, returning its output.
   */
  async run(command: string | string[], opts?: ShellRunOpts): Promise<string> {
    const cmdString = Array.isArray(command) ? command.join(" && ") : command;
    return this.withSpan(
      "commands.run",
      {
        "command.text": cmdString,
        "command.cwd": opts?.cwd || "/project",
        "command.asGlobalSession": opts?.asGlobalSession || false,
      },
      async () => {
        const cmd = await this.runBackground(command, opts);
        return cmd.waitUntilComplete();
      }
    );
  }

  /**
   * Get all running commands.
   */
  async getAll(): Promise<Command[]> {
    return this.withSpan("commands.getAll", {}, async () => {
      const shells = await this.agentClient.shells.getShells();

      return shells
        .filter(
          (shell): shell is protocol.shell.CommandShellDTO =>
            shell.shellType === "TERMINAL" && isCommandShell(shell)
        )
        .map(
          (shell) =>
            new Command(
              this.agentClient,
              shell,
              JSON.parse(shell.name),
              this.tracer
            )
        );
    });
  }
}

export function isCommandShell(
  shell: protocol.shell.ShellDTO
): shell is protocol.shell.CommandShellDTO {
  try {
    const parsed = JSON.parse(shell.name);

    return parsed.type === "command";
  } catch {
    return false;
  }
}

export class Command {
  private disposable = new Disposable();
  private tracer?: Tracer;
  // TODO: differentiate between stdout and stderr, also send back bytes instead of
  // strings
  private onOutputEmitter = this.disposable.addDisposable(
    new Emitter<string>()
  );
  /**
   * An event that is emitted when the command outputs something.
   */
  public readonly onOutput = this.onOutputEmitter.event;

  private onStatusChangeEmitter = this.disposable.addDisposable(
    new Emitter<CommandStatus>()
  );
  /**
   * An event that is emitted when the command status changes.
   */
  public readonly onStatusChange = this.onStatusChangeEmitter.event;
  private barrier = new Barrier<void>();

  private output: string[] = [];

  /**
   * The status of the command.
   */
  #status: CommandStatus = "RUNNING";

  get status(): CommandStatus {
    return this.#status;
  }

  set status(value: CommandStatus) {
    if (this.#status !== value) {
      this.#status = value;
      this.onStatusChangeEmitter.fire(this.#status);
    }
  }

  /**
   * The command that was run
   */
  command: string;

  /**
   * The name of the command
   */
  name?: string;

  constructor(
    private agentClient: IAgentClient,
    private shell: protocol.shell.ShellDTO & { buffer?: string[] },
    details: { command: string; name?: string },
    tracer?: Tracer
  ) {
    this.command = details.command;
    this.name = details.name;
    this.tracer = tracer;

    this.disposable.addDisposable(
      agentClient.shells.onShellExited(({ shellId, exitCode }) => {
        if (shellId === this.shell.shellId) {
          this.status = exitCode === 0 ? "FINISHED" : "ERROR";
          this.barrier.open();
        }
      })
    );

    this.disposable.addDisposable(
      agentClient.shells.onShellTerminated(({ shellId }) => {
        if (shellId === this.shell.shellId) {
          this.status = "KILLED";
          this.barrier.open();
        }
      })
    );

    this.disposable.addDisposable(
      this.agentClient.shells.onShellOut(({ shellId, out }) => {
        if (shellId !== this.shell.shellId || out.startsWith("[CODESANDBOX]")) {
          return;
        }

        console.log("GOTZ OUT");

        this.onOutputEmitter.fire(out);

        this.output.push(out);
        if (this.output.length > 1000) {
          this.output.shift();
        }
      })
    );
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
   * Open the command and get its current output, subscribes to future output
   */
  async open(dimensions = DEFAULT_SHELL_SIZE): Promise<string> {
    return this.withSpan(
      "command.open",
      {
        "command.shellId": this.shell.shellId,
        "command.text": this.command,
        "command.dimensions.cols": dimensions.cols,
        "command.dimensions.rows": dimensions.rows,
      },
      async () => {
        const shell = await this.agentClient.shells.open(
          this.shell.shellId,
          dimensions
        );

        this.output = shell.buffer;

        return this.output.join("\n");
      }
    );
  }

  /**
   * Wait for the command to finish with its returned output
   */
  async waitUntilComplete(): Promise<string> {
    return this.withSpan(
      "command.waitUntilComplete",
      {
        "command.shellId": this.shell.shellId,
        "command.text": this.command,
        "command.status": this.status,
      },
      async () => {
        await this.barrier.wait();

        const cleaned = this.output
          .join("\n")
          .replace(
            /Error: failed to exec in podman container: exit status 1[\s\S]*$/,
            ""
          );

        if (this.status === "FINISHED") {
          return cleaned;
        }

        throw new Error(`Command ERROR: ${cleaned}`);
      }
    );
  }

  // TODO: allow for kill signals
  /**
   * Kill the command and remove it from the session.
   */
  async kill(): Promise<void> {
    return this.withSpan(
      "command.kill",
      {
        "command.shellId": this.shell.shellId,
        "command.text": this.command,
        "command.status": this.status,
      },
      async () => {
        this.disposable.dispose();
        await this.agentClient.shells.delete(this.shell.shellId);
      }
    );
  }

  /**
   * Restart the command.
   */
  async restart(): Promise<void> {
    return this.withSpan(
      "command.restart",
      {
        "command.shellId": this.shell.shellId,
        "command.text": this.command,
        "command.status": this.status,
      },
      async () => {
        if (this.status !== "RUNNING") {
          throw new Error("Command is not running");
        }

        await this.agentClient.shells.restart(this.shell.shellId);
      }
    );
  }
}
