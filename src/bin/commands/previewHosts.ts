import type * as yargs from "yargs";

import { API } from "../../API";
import { getInferredApiKey } from "../../utils/constants";

function getAPI() {
  const apiKey = getInferredApiKey();
  return new API({ apiKey });
}

export const previewHostsCommand: yargs.CommandModule = {
  command: "preview-hosts",
  describe:
    "Manage preview hosts that should be able to access the Preview API",
  builder: (yargs) => {
    return yargs
      .command({
        command: "list",
        describe: "List current preview hosts",
        handler: async () => {
          const api = getAPI();
          const response = await api.listPreviewHosts();
          const hosts = response.preview_hosts.map(({ host }) => host);
          if (hosts.length) {
            console.log(hosts.join("\n"));
          } else {
            console.log("No preview hosts found");
          }
        },
      })
      .command({
        command: "add <host>",
        describe: "Add a preview host",
        builder: (yargs) =>
          yargs.positional("host", {
            describe: "Host to add",
            type: "string",
            demandOption: true,
          }),
        handler: async (argv) => {
          const api = getAPI();
          const response = await api.listPreviewHosts();
          let hosts = response.preview_hosts.map(({ host }) => host);
          const hostToAdd = (argv.host as string).trim();
          if (hosts.includes(hostToAdd)) {
            console.log(`Host already exists: ${hostToAdd}`);
            return;
          }
          hosts.push(hostToAdd);
          await api.updatePreviewHost({ hosts });
          console.log(`Added preview host: ${hostToAdd}`);
        },
      })
      .command({
        command: "remove <host>",
        describe: "Remove a preview host",
        builder: (yargs) =>
          yargs.positional("host", {
            describe: "Host to remove",
            type: "string",
            demandOption: true,
          }),
        handler: async (argv) => {
          const api = getAPI();
          const response = await api.listPreviewHosts();
          let hosts = response.preview_hosts.map(({ host }) => host);
          const hostToRemove = (argv.host as string).trim();
          if (!hosts.includes(hostToRemove)) {
            console.log(`Host not found: ${hostToRemove}`);
            return;
          }
          hosts = hosts.filter((h) => h !== hostToRemove);
          await api.updatePreviewHost({ hosts });
          console.log(`Removed preview host: ${hostToRemove}`);
        },
      })
      .command({
        command: "clear",
        describe: "Clear all preview hosts",
        handler: async () => {
          const api = getAPI();
          const response = await api.listPreviewHosts();
          const hosts = response.preview_hosts.map(({ host }) => host);
          if (hosts.length === 0) {
            console.log("Preview host list is already empty.");
            return;
          }
          await api.updatePreviewHost({ hosts: [] });
          console.log("Cleared all preview hosts.");
        },
      });
  },
  handler: () => {},
};
