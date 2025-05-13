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
  private run(command: string, env: Record<string, string> = {}) {
    return this.commands.run(command, {
      env,
    });
  }

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
        NO_COLOR: "true",
      }
    );
  }
  python(code: string) {
    return this.run(`python3 -c "exec('''\
${code
  .split("\n")
  .map((line, index, lines) => {
    return index === lines.length - 1 && !line.startsWith("print")
      ? `print(${line})`
      : line;
  })
  .join("\n")}
''')"`);
  }
}
