import ora from "ora";

import { CodeSandbox } from "@codesandbox/sdk";

export async function forkSandbox(sandboxId: string) {
  const sdk = new CodeSandbox();

  const spinner = ora("Forking sandbox...").start();
  const sandbox2 = await sdk.sandboxes.create({
    id: sandboxId,
  });
  spinner.succeed("Sandbox forked successfully");

  // eslint-disable-next-line no-console
  console.log(sandbox2.id);
}
