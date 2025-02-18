import type { CommandModule } from "yargs";
import { forkSandbox } from "./fork";
import { hibernateSandbox } from "./hibernate";
import { listSandboxes } from "./list";
import { shutdownSandbox } from "./shutdown";
import {
  listPreviewTokens,
  createPreviewToken,
  revokeAllPreviewTokens,
  revokePreviewToken,
  updatePreviewToken,
} from "./preview-tokens";

const DEFAULT_LIMIT = 100;

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
              orderBy: argv["order-by"] as
                | "inserted_at"
                | "updated_at"
                | undefined,
              direction: argv.direction as "asc" | "desc" | undefined,
              pagination:
                argv.page || argv["page-size"]
                  ? {
                      page: argv.page,
                      pageSize: argv["page-size"],
                    }
                  : undefined,
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
            demandOption: true,
          });
        },
        handler: async (argv) => {
          await forkSandbox(argv.id);
        },
      })
      .command({
        command: "hibernate [id]",
        describe:
          "Hibernate sandbox(es). If no ID is provided, reads sandbox IDs from stdin",
        builder: (yargs) => {
          return yargs.positional("id", {
            describe: "ID of the sandbox to hibernate",
            type: "string",
          });
        },
        handler: async (argv) => {
          await hibernateSandbox(argv.id);
        },
      })
      .command({
        command: "shutdown [id]",
        describe:
          "Shutdown sandbox(es). If no ID is provided, reads sandbox IDs from stdin",
        builder: (yargs) => {
          return yargs.positional("id", {
            describe: "ID of the sandbox to shutdown",
            type: "string",
          });
        },
        handler: async (argv) => {
          await shutdownSandbox(argv.id);
        },
      })
      .command({
        command: "preview-tokens",
        describe: "Manage preview tokens",
        builder: (yargs) => {
          return yargs
            .command({
              command: "list <id>",
              describe: "List preview tokens",
              builder: (yargs) => {
                return yargs.positional("id", {
                  describe: "ID of the sandbox",
                  type: "string",
                  demandOption: true,
                });
              },
              handler: async (argv) => {
                await listPreviewTokens(argv.id);
              },
            })
            .command({
              command: "create <id>",
              describe: "Create a preview token",
              builder: (yargs) => {
                return yargs
                  .positional("id", {
                    describe: "ID of the sandbox",
                    type: "string",
                    demandOption: true,
                  })
                  .option("expires-at", {
                    alias: "e",
                    describe:
                      "Expiration date (ISO 8601 format, e.g. 2024-12-31T23:59:59Z). Can be omitted to create a token that never expires.",
                    type: "string",
                  });
              },
              handler: async (argv) => {
                await createPreviewToken(argv.id, argv["expires-at"]);
              },
            })
            .command({
              command: "update <sandbox-id> <preview-token-id>",
              describe:
                "Update the expiration date of a preview token, if no expiration",
              builder: (yargs) => {
                return yargs
                  .positional("sandbox-id", {
                    describe: "ID of the sandbox",
                    type: "string",
                    demandOption: true,
                  })
                  .positional("preview-token-id", {
                    describe: "ID of the preview token",
                    type: "string",
                    demandOption: true,
                  })
                  .option("expires-at", {
                    alias: "e",
                    describe:
                      "Expiration date (ISO 8601 format, e.g. 2024-12-31T23:59:59Z). Can be omitted to remove the expiration date.",
                    type: "string",
                  });
              },
              handler: async (argv) => {
                await updatePreviewToken(
                  argv["sandbox-id"],
                  argv["preview-token-id"],
                  argv["expires-at"]
                );
              },
            })
            .command({
              command: "revoke <sandbox-id> <preview-token-id>",
              describe: "Revoke preview token(s)",
              builder: (yargs) => {
                return yargs
                  .positional("sandbox-id", {
                    describe: "ID of the sandbox",
                    type: "string",
                    demandOption: true,
                  })
                  .positional("preview-token-id", {
                    describe: "ID of the preview token",
                    type: "string",
                    demandOption: true,
                  })
                  .option("all", {
                    alias: "a",
                    describe: "Revoke all preview tokens",
                    type: "boolean",
                  });
              },
              handler: async (argv) => {
                if (argv.all) {
                  await revokeAllPreviewTokens(argv["sandbox-id"]);
                } else {
                  await revokePreviewToken(
                    argv["sandbox-id"],
                    argv["preview-token-id"]
                  );
                }
              },
            })
            .demandCommand(1, "Please specify a preview-tokens command");
        },
        handler: () => {},
      })
      .demandCommand(1, "Please specify a sandbox command");
  },
  handler: () => {},
};
