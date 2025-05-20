import readline from "readline";

import { createClient, createConfig, type Client } from "@hey-api/client-fetch";
import ora from "ora";
import type * as yargs from "yargs";

import {
  previewHostList,
  previewHostCreate,
  previewHostUpdate,
} from "../../api-clients/client";
import { handleResponse } from "../../utils/api";
import { BASE_URL, getApiKey } from "../utils/constants";

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
          const API_KEY = getApiKey();
          const apiClient: Client = createClient(
            createConfig({
              baseUrl: BASE_URL,
              headers: {
                Authorization: `Bearer ${API_KEY}`,
              },
            })
          );
          const resp = await previewHostList({ client: apiClient });
          const data = handleResponse(resp, "Failed to list preview hosts");
          const hosts = data.preview_hosts.map(({ host }) => host);
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
          const API_KEY = getApiKey();
          const apiClient: Client = createClient(
            createConfig({
              baseUrl: BASE_URL,
              headers: {
                Authorization: `Bearer ${API_KEY}`,
              },
            })
          );
          const resp = await previewHostList({ client: apiClient });
          const data = handleResponse(resp, "Failed to list preview hosts");
          let hosts = data.preview_hosts.map(({ host }) => host);
          const hostToAdd = (argv.host as string).trim();
          if (hosts.includes(hostToAdd)) {
            console.log(`Host already exists: ${hostToAdd}`);
            return;
          }
          hosts.push(hostToAdd);
          await previewHostUpdate({
            client: apiClient,
            body: { hosts },
          });
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
          const API_KEY = getApiKey();
          const apiClient: Client = createClient(
            createConfig({
              baseUrl: BASE_URL,
              headers: {
                Authorization: `Bearer ${API_KEY}`,
              },
            })
          );
          const resp = await previewHostList({ client: apiClient });
          const data = handleResponse(resp, "Failed to list preview hosts");
          let hosts = data.preview_hosts.map(({ host }) => host);
          const hostToRemove = (argv.host as string).trim();
          if (!hosts.includes(hostToRemove)) {
            console.log(`Host not found: ${hostToRemove}`);
            return;
          }
          hosts = hosts.filter((h) => h !== hostToRemove);
          await previewHostUpdate({
            client: apiClient,
            body: { hosts },
          });
          console.log(`Removed preview host: ${hostToRemove}`);
        },
      })
      .command({
        command: "clear",
        describe: "Clear all preview hosts",
        handler: async () => {
          const API_KEY = getApiKey();
          const apiClient: Client = createClient(
            createConfig({
              baseUrl: BASE_URL,
              headers: {
                Authorization: `Bearer ${API_KEY}`,
              },
            })
          );
          const resp = await previewHostList({ client: apiClient });
          const data = handleResponse(resp, "Failed to list preview hosts");
          const hosts = data.preview_hosts.map(({ host }) => host);
          if (hosts.length === 0) {
            console.log("Preview host list is already empty.");
            return;
          }
          await previewHostUpdate({
            client: apiClient,
            body: { hosts: [] },
          });
          console.log("Cleared all preview hosts.");
        },
      });
  },
  handler: () => {},
};
