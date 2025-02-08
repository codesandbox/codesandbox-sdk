import ora from "ora";
import { CodeSandbox } from "../../../";

type CommandResult = {
  success: boolean;
  message: string;
};

async function hibernateSingleSandbox(
  id: string,
  spinner: ReturnType<typeof ora>
): Promise<CommandResult> {
  try {
    await new CodeSandbox().sandbox.hibernate(id);
    const message = `✔ Sandbox ${id} hibernated successfully`;
    // eslint-disable-next-line no-console
    console.log(message);
    return { success: true, message };
  } catch (error) {
    const message = `✖ Failed to hibernate sandbox ${id}`;
    // eslint-disable-next-line no-console
    console.log(message);
    return { success: false, message };
  }
}

export async function hibernateSandbox(id?: string) {
  if (id) {
    const spinner = ora("Hibernating sandbox...").start();
    const result = await hibernateSingleSandbox(id, spinner);
    spinner.stop();
    if (!result.success) {
      process.exit(1);
    }
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
      // eslint-disable-next-line no-console
      console.log("No sandbox IDs provided");
      process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log(`⠋ Hibernating ${ids.length} sandboxes...`);

    let successCount = 0;
    let failCount = 0;
    const results: CommandResult[] = [];

    // Run all hibernations in parallel
    const hibernatePromises = ids.map((sandboxId) =>
      hibernateSingleSandbox(sandboxId, null as any)
        .then((result) => {
          results.push(result);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
          return result;
        })
        .catch(() => {
          failCount++;
          return {
            success: false,
            message: `Failed to hibernate sandbox ${sandboxId}`,
          };
        })
    );

    await Promise.all(hibernatePromises);

    // Final summary
    if (failCount === 0) {
      // eslint-disable-next-line no-console
      console.log(`\n✔ Successfully hibernated all ${successCount} sandboxes`);
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `\n⚠ Hibernation completed: ${successCount} succeeded, ${failCount} failed`
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log("Failed to hibernate sandboxes");
    throw error;
  }
}
