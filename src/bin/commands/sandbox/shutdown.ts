import ora from "ora";
import { CodeSandbox } from "../../../";

async function shutdownSingleSandbox(
  id: string,
  spinner: ReturnType<typeof ora>
) {
  try {
    await new CodeSandbox().sandbox.shutdown(id);
    spinner.succeed(`Sandbox ${id} shutdown successfully`);
  } catch (error) {
    spinner.fail(`Failed to shutdown sandbox ${id}`);
    throw error;
  }
}

export async function shutdownSandbox(id?: string) {
  const spinner = ora("Shutting down sandbox...").start();

  if (id) {
    await shutdownSingleSandbox(id, spinner);
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

    spinner.text = `Shutting down ${ids.length} sandboxes...`;

    for (const sandboxId of ids) {
      await shutdownSingleSandbox(sandboxId, spinner);
    }

    spinner.succeed(`Successfully shutdown ${ids.length} sandboxes`);
  } catch (error) {
    spinner.fail("Failed to shutdown sandboxes");
    throw error;
  }
}
