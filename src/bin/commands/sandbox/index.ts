import type { CommandModule } from "yargs";
import { forkSandbox } from "./fork";
import { hibernateSandbox } from "./hibernate";
import { DEFAULT_LIMIT, listSandboxes } from "./list";
import { shutdownSandbox } from "./shutdown";

export const sandboxCommand: CommandModule = {
  command: "sandbox",
  describe: "Manage sandboxes",
  builder: (yargs) => {
    return yargs
      .command({
        command: "list",
        describe: "List sandboxes",
        builder: (yargs) => {
          return yargs
            .option("output", {
              alias: "o",
              describe:
                "Output format (comma-separated list of fields: id,title,privacy,tags,createdAt,updatedAt)",
              type: "string",
            })
            .option("headers", {
              describe: "Show headers",
              type: "boolean",
              default: true,
            })
            .option("tags", {
              alias: "t",
              describe: "Filter by tags (comma-separated)",
              type: "string",
            })
            .option("status", {
              alias: "s",
              describe: "Filter by status",
              choices: ["running"],
              type: "string",
            })
            .option("page", {
              alias: "p",
              describe: "Page number",
              type: "number",
            })
            .option("page-size", {
              describe: "Number of items per page",
              type: "number",
            })
            .option("order-by", {
              describe: "Order results by field",
              choices: ["inserted_at", "updated_at"],
              type: "string",
            })
            .option("direction", {
              describe: "Sort direction",
              choices: ["asc", "desc"],
              type: "string",
            })
            .option("limit", {
              alias: "l",
              describe: `Maximum number of sandboxes to list (default: ${DEFAULT_LIMIT})`,
              type: "number",
              default: DEFAULT_LIMIT,
            });
        },
        handler: async (argv) => {
          await listSandboxes(
            argv.output as string | undefined,
            {
              tags: argv.tags?.split(","),
              status: argv.status as "running" | undefined,
              page: argv.page as number | undefined,
              pageSize: argv["page-size"] as number | undefined,
              orderBy: argv["order-by"] as
                | "inserted_at"
                | "updated_at"
                | undefined,
              direction: argv.direction as "asc" | "desc" | undefined,
            },
            argv["headers"] as boolean,
            argv.limit as number | undefined
          );
        },
      })
      .command({
        command: "fork <id>",
        describe: "Fork a sandbox",
        builder: (yargs) => {
          return yargs.positional("id", {
            describe: "ID of the sandbox to fork",
            type: "string",
          });
        },
        handler: async (argv) => {
          await forkSandbox(argv.id as string);
        },
      })
      .command({
        command: "hibernate <id>",
        describe: "Hibernate a sandbox",
        builder: (yargs) => {
          return yargs.positional("id", {
            describe: "ID of the sandbox to hibernate",
            type: "string",
          });
        },
        handler: async (argv) => {
          await hibernateSandbox(argv.id as string);
        },
      })
      .command({
        command: "shutdown <id>",
        describe: "Shutdown a sandbox",
        builder: (yargs) => {
          return yargs.positional("id", {
            describe: "ID of the sandbox to shutdown",
            type: "string",
          });
        },
        handler: async (argv) => {
          await shutdownSandbox(argv.id as string);
        },
      })
      .demandCommand(1, "Please specify a sandbox command");
  },
  handler: () => {},
};
