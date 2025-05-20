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

export type PreviewHostsCommandArgs = {
  list?: boolean;
  add?: string;
  remove?: string;
  clear?: boolean;
};

export const previewHostsCommand: yargs.CommandModule<
  Record<string, never>,
  PreviewHostsCommandArgs
> = {
  command: "preview-hosts",
  describe:
    "Manage preview hosts for your workspace. This allows you to access use the preview API from trusted hosts.",
  builder: (yargs: yargs.Argv) =>
    yargs
      .option("list", {
        describe: "List current preview hosts",
        type: "boolean",
      })
      .option("add", {
        describe: "Add a preview host, ex. ",
        type: "string",
      })
      .option("clear", {
        describe: "Clear all preview hosts",
        type: "boolean",
      })
      .option("remove", {
        describe: "Remove a preview host",
        type: "string",
      }),
  handler: async (argv) => {
    // Only allow one operation at a time
    const ops = [argv.list, argv.add, argv.remove, argv.clear].filter(Boolean);
    if (ops.length !== 1) {
      throw new Error(
        "Please specify exactly one operation: --list, --add, --remove, or --clear"
      );
    }

    const API_KEY = getApiKey();
    const apiClient: Client = createClient(
      createConfig({
        baseUrl: BASE_URL,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      })
    );

    if (argv.list) {
      const resp = await previewHostList({ client: apiClient });
      const data = handleResponse(resp, "Failed to list preview hosts");
      const hosts = data.preview_hosts.map(({ host }) => host);
      if (hosts.length) {
        console.log(hosts.join("\n"));
      } else {
        console.log("No preview hosts found");
      }
      return;
    }

    // For add, remove, clear: always work with the full list
    const resp = await previewHostList({ client: apiClient });
    const data = handleResponse(resp, "Failed to list preview hosts");
    let hosts = data.preview_hosts.map(({ host }) => host);

    if (argv.add) {
      const hostToAdd = argv.add.trim();
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
      return;
    }

    if (argv.remove) {
      const hostToRemove = argv.remove.trim();
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
      return;
    }

    if (argv.clear) {
      if (hosts.length === 0) {
        console.log("Preview host list is already empty.");
        return;
      }
      await previewHostUpdate({
        client: apiClient,
        body: { hosts: [] },
      });
      console.log("Cleared all preview hosts.");
      return;
    }
  },
};
