import type { IPitcherClient } from "@codesandbox/pitcher-client";

import { Disposable } from "../../utils/disposable";
import { Commands } from "./commands";

export class Interpreters {
  private disposable = new Disposable();
  constructor(
    sessionDisposable: Disposable,
    private pitcherClient: IPitcherClient,
    private commands: Commands
  ) {
    sessionDisposable.onWillDispose(() => {
      this.disposable.dispose();
    });
  }
  private async run(command: string, env: Record<string, string> = {}) {
    return this.commands.run(command, {
      env,
    });
  }

  async javascript(code: string) {
    const command = await this.run(
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
        NO_COLOR: "true",
      }
    );

    console.log(command);

    return command.getOutput();
  }
  async python(code: string) {
    const command = await this.run(`python3 -c "exec('''\
${code
  .split("\n")
  .map((line, index, lines) => {
    return index === lines.length - 1 && !line.startsWith("print")
      ? `print(${line})`
      : line;
  })
  .join("\n")}
''')"`);

    return command.getOutput();
  }
}
