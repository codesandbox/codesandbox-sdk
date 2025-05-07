import type { IPitcherClient } from "@codesandbox/pitcher-client";

import { Disposable } from "../../utils/disposable";
import { type Event } from "../../utils/event";
import { Command, Commands } from "./commands";

export interface RunningInterpreter
  extends Promise<{ output: string; exitCode?: number }> {
  onOutput: Event<string>;
  kill(): void;
}

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

  public readonly js = new LanguageInterpreter(
    this.pitcherClient,
    this.commands,
    {
      runtime: "node",
      extension: "js",
      env: { NO_COLOR: "true" },
    }
  );
  public readonly python = new LanguageInterpreter(
    this.pitcherClient,
    this.commands,
    {
      runtime: "python",
      extension: "py",
      env: {},
    }
  );
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
    private commands: Commands,
    private opts: ILanguageInterpreterOpts
  ) {}

  async run(code: string): Promise<Command> {
    const randomString = getRandomString();
    const tmpFileName = `/tmp/tmp.${randomString}.${this.opts.extension}`;
    const command = `${this.opts.runtime} ${tmpFileName}`;

    const tmpFile = await this.pitcherClient.clients.fs.writeFile(
      tmpFileName,
      new TextEncoder().encode(code),
      true,
      true
    );

    if (tmpFile.type === "error") {
      throw new Error(`${tmpFile.errno}: ${tmpFile.error}`);
    }

    return this.commands.run(command, {
      env: this.opts.env,
    });
  }
}
