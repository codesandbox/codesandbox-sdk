import { Disposable } from "../utils/disposable";
import { SandboxCommands, ShellRunOpts } from "./commands";
import { Tracer, SpanStatusCode } from "@opentelemetry/api";

export class Interpreters {
  private disposable = new Disposable();
  private tracer?: Tracer;

  constructor(
    sessionDisposable: Disposable,
    private commands: SandboxCommands,
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

  private run(command: string, opts?: ShellRunOpts) {
    return this.commands.run(command, opts);
  }

  /**
   * Run a JavaScript code snippet in a new shell.
   */
  javascript(code: string) {
    return this.withSpan(
      "interpreters.javascript",
      {
        "interpreter.language": "javascript",
        "interpreter.code": code,
        "interpreter.codeLength": code.length
      },
      async () => {
        return this.run(
          `node -p "$(cat <<'EOF'
(() => {${code
          .split("\n")
          .map((line, index, lines) => {
            return index === lines.length - 1 && !line.startsWith("return")
              ? `return ${line}`
              : line;
          })
          .join("\n")}})()
EOF
)"`,
          {
            env: {
              NO_COLOR: "true",
            },
          }
        );
      }
    );
  }

  /**
   * Run a Python code snippet in a new shell.
   */
  python(code: string) {
    return this.withSpan(
      "interpreters.python",
      {
        "interpreter.language": "python",
        "interpreter.code": code,
        "interpreter.codeLength": code.length
      },
      async () => {
        return this.run(`python3 <<'PYCODE'
${code
  .split("\n")
  .map((line, index, lines) => {
    return index === lines.length - 1 && !line.startsWith("print")
      ? `print(${line})`
      : line;
  })
  .join("\n")}
PYCODE
`);
      }
    );
  }
}
