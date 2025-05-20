import { Disposable } from "../../utils/disposable";
import { Commands, ShellRunOpts } from "./commands";

export class Interpreters {
  private disposable = new Disposable();
  constructor(sessionDisposable: Disposable, private commands: Commands) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }

  private run(command: string, opts?: ShellRunOpts) {
    return this.commands.run(command, opts);
  }

  /**
   * Run a JavaScript code snippet in a new shell.
   */
  javascript(code: string) {
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

  /**
   * Run a Python code snippet in a new shell.
   */
  python(code: string) {
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
}
