import ora from "ora";
import { CodeSandbox } from "../../../";

async function hibernateSingleSandbox(
  id: string,
  spinner: ReturnType<typeof ora>
) {
  try {
    await new CodeSandbox().sandbox.hibernate(id);
    spinner.succeed(`Sandbox ${id} hibernated successfully`);
  } catch (error) {
    spinner.fail(`Failed to hibernate sandbox ${id}`);
    throw error;
  }
}

export async function hibernateSandbox(id?: string) {
  const spinner = ora("Hibernating sandbox...").start();

  if (id) {
    await hibernateSingleSandbox(id, spinner);
    return;
  }

  // No ID provided, try to read from stdin
  process.stdin.resume();
  process.stdin.setEncoding("utf-8");

  let data = "";

  try {
    for await (const chunk of process.stdin) {
      data += chunk;
    }

    const ids = data
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (ids.length === 0) {
      spinner.fail("No sandbox IDs provided");
      process.exit(1);
    }

    spinner.text = `Hibernating ${ids.length} sandboxes...`;

    for (const sandboxId of ids) {
      await hibernateSingleSandbox(sandboxId, spinner);
    }

    spinner.succeed(`Successfully hibernated ${ids.length} sandboxes`);
  } catch (error) {
    spinner.fail("Failed to hibernate sandboxes");
    throw error;
  }
}
