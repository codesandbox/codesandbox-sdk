import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { buildCommand } from "./commands/build";
import { sandboxesCommand } from "./commands/sandbox";
import { previewHostsCommand } from "./commands/previewHosts";
import { hostTokensCommand } from "./commands/host-tokens";

yargs(hideBin(process.argv))
  .usage("CodeSandbox SDK CLI - Manage your CodeSandbox projects")
  .demandCommand(1, "Usage: csb <command> [options]")
  .scriptName("csb")
  .strict()
  .recommendCommands()
  .command(buildCommand)
  .command(sandboxesCommand)
  .command(hostTokensCommand)
  .command(previewHostsCommand)
  .parse();
