import type { CommandModule } from "yargs";
import {
  listPreviewTokens,
  createPreviewToken,
  revokeAllPreviewTokens,
  revokePreviewToken,
  updatePreviewToken,
} from "./sandbox/host-tokens";

export const hostTokensCommand: CommandModule = {
  command: "host-tokens",
  describe: "Manage host tokens",
  builder: (yargs) => {
    return yargs
      .command({
        command: "list <sandbox-id>",
        describe: "List host tokens for a sandbox",
        builder: (yargs) => {
          return yargs.positional("sandbox-id", {
            describe: "ID of the sandbox",
            type: "string",
            demandOption: true,
          });
        },
        handler: async (argv) => {
          await listPreviewTokens(argv.sandboxId as string);
        },
      })
      .command({
        command: "create <sandbox-id>",
        describe: "Create a host token for a sandbox",
        builder: (yargs) => {
          return yargs
            .positional("sandbox-id", {
              describe: "ID of the sandbox",
              type: "string",
              demandOption: true,
            })
            .option("expires-at", {
              alias: "e",
              describe:
                "Expiration date (ISO 8601 format, e.g. 2024-12-31T23:59:59Z).",
              type: "string",
              demandOption: true,
            });
        },
        handler: async (argv) => {
          await createPreviewToken(
            argv.sandboxId as string,
            argv["expires-at"] as string
          );
        },
      })
      .command({
        command: "update <sandbox-id> <host-token-id>",
        describe: "Update the expiration date of a host token",
        builder: (yargs) => {
          return yargs
            .positional("sandbox-id", {
              describe: "ID of the sandbox",
              type: "string",
              demandOption: true,
            })
            .positional("host-token-id", {
              describe: "ID of the host token",
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
            argv["sandbox-id"] as string,
            argv["host-token-id"] as string,
            argv["expires-at"] as string | undefined
          );
        },
      })
      .command({
        command: "revoke <sandbox-id> [host-token-id]",
        describe: "Revoke host token(s)",
        builder: (yargs) => {
          return yargs
            .positional("sandbox-id", {
              describe: "ID of the sandbox",
              type: "string",
              demandOption: true,
            })
            .positional("host-token-id", {
              describe: "ID of the host token",
              type: "string",
            })
            .option("all", {
              alias: "a",
              describe: "Revoke all preview tokens",
              type: "boolean",
              conflicts: "host-token-id",
            });
        },
        handler: async (argv) => {
          if (argv.all) {
            await revokeAllPreviewTokens(argv["sandbox-id"] as string);
          } else if (argv["host-token-id"]) {
            await revokePreviewToken(
              argv["sandbox-id"] as string,
              argv["host-token-id"] as string
            );
          } else {
            console.error(
              "Error: Either specify a host token ID or use --all to revoke all tokens"
            );
            process.exit(1);
          }
        },
      });
  },
  handler: () => {},
};
