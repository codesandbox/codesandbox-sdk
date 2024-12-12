import ora from "ora";

import { CodeSandbox } from "../../../";

export async function forkSandbox(sandboxId: string) {
  const sdk = new CodeSandbox();

  const spinner = ora("Forking sandbox...").start();
  const sandbox2 = await sdk.sandbox.fork(sandboxId);
  spinner.succeed("Sandbox forked successfully");

  sandbox2.disconnect();
  // eslint-disable-next-line no-console
  console.log(sandbox2.id);
}