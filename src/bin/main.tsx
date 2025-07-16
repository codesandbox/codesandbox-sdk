import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { render } from "ink";

import { buildCommand } from "./commands/build";
import { sandboxesCommand } from "./commands/sandbox";
import { previewHostsCommand } from "./commands/previewHosts";
import { hostTokensCommand } from "./commands/hostTokens";
import { App } from "./ui/App";
import React from "react";
import { SDKProvider } from "./ui/sdkContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ViewProvider } from "./ui/viewContext";

if (process.argv.length === 2) {
  // Clear the screen before rendering the App
  process.stdout.write("\x1Bc");

  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <SDKProvider>
        <ViewProvider>
          <App />
        </ViewProvider>
      </SDKProvider>
    </QueryClientProvider>,
    {
      exitOnCtrlC: true,
    }
  );
} else {
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
}
