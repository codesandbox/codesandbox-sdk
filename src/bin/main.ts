import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { buildCommand } from "./commands/build";
import { sandboxCommand } from "./commands/sandbox";
import { previewHostsCommand } from "./commands/previewHosts";

yargs(hideBin(process.argv))
  .usage("CodeSandbox SDK CLI - Manage your CodeSandbox projects")
  .demandCommand(1, "Usage: csb <command> [options]")
  .scriptName("csb")
  .strict()
  .recommendCommands()
  .command(buildCommand)
  .command(sandboxCommand)
  .command(previewHostsCommand)
  .parse();
