import { promises as fs } from "fs";
import path from "path";

import { DisposableStore } from "@codesandbox/pitcher-common";
import { createClient, createConfig, type Client } from "@hey-api/client-fetch";
import ora from "ora";
import type * as yargs from "yargs";

import type { SetupProgress } from "../../";
import { CodeSandbox, PortInfo } from "../../";
import { sandboxList, sandboxCreate } from "../../client";
import { handleResponse } from "../../utils/handle-response";
import { BASE_URL, getApiKey } from "../utils/constants";
import { hashDirectory } from "../utils/hash";

export type BuildCommandArgs = {
  path: string;
  force?: boolean;
  ipCountry?: string;
  fromSandbox?: string;
  skipFiles?: boolean;
  cluster?: string;
};

export const buildCommand: yargs.CommandModule<
  Record<string, never>,
  BuildCommandArgs
> = {
  command: "build <path>",
  describe:
    "Build an efficient memory snapshot from a directory. This snapshot can be used to create sandboxes quickly.",
  builder: (yargs: yargs.Argv) =>
    yargs
      .option("force", {
        alias: "f",
        describe:
          "Force the creation of a new sandbox, normally a sandbox is reused if it already exists for the given folder (if the files are the same)",
        type: "boolean",
      })
      .option("ip-country", {
        describe:
          "Cluster closest to this country to create the snapshot in, this ensures that sandboxes created of this snapshot will be created in the same cluster",
        type: "string",
      })
      .option("from-sandbox", {
        describe: "Use and update an existing sandbox as a template",
        type: "string",
      })
      .option("skip-files", {
        describe: "Skip writing files to the sandbox",
        type: "boolean",
      })
      .option("cluster", {
        describe: "Cluster to create the sandbox in",
        type: "string",
      })
      .positional("path", {
        describe: "Path to the project",
        type: "string",
        demandOption: "Path to the project is required",
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

    const spinner = ora("Indexing folder...").start();

    try {
      const getSdk = (cluster?: string) => {
        const headers: Record<string, string> = cluster
          ? {
              "x-pitcher-manager-url": `https://${cluster}.pitcher.csb.app/api/v1`,
            }
          : {};

        return {
          sdk: new CodeSandbox(API_KEY, {
            baseUrl: BASE_URL,
            headers,
          }),
          cluster,
        };
      };

      const { sdk, cluster } = getSdk(argv.cluster);
      const { hash, files: filePaths } = await hashDirectory(argv.path);
      spinner.succeed(`Indexed ${filePaths.length} files`);
      const shortHash = hash.slice(0, 6);
      const tag = `sha:${shortHash}-${cluster || ""}`;

      spinner.start(`Creating or updating sandbox...`);
      const { alreadyExists, sandboxId } = argv.fromSandbox
        ? {
            alreadyExists: true,
            sandboxId: argv.fromSandbox,
          }
        : await getOrCreateSandbox(apiClient, tag, argv.force);

      if (alreadyExists && !argv.fromSandbox) {
        spinner.succeed("Sandbox snapshot has been created before:");
        // eslint-disable-next-line no-console
        console.log(sandboxId);
        return;
      }

      if (argv.fromSandbox) {
        spinner.succeed("Sandbox reused");
      } else {
        spinner.succeed("Sandbox created");
      }

      if (argv.cluster) {
        spinner.start(`Starting sandbox in cluster ${argv.cluster}...`);
      } else {
        spinner.start(`Starting sandbox...`);
      }

      const sandbox = await sdk.sandbox.open(sandboxId, {
        ipcountry: argv.ipCountry,
      });
      spinner.succeed("Sandbox opened");

      if (!argv.skipFiles) {
        spinner.start("Writing files to sandbox...");
        let i = 0;
        for (const filePath of filePaths) {
          i++;
          spinner.start(`Writing file ${i} of ${filePaths.length}...`);
          const fullPath = path.join(argv.path, filePath);
          const content = await fs.readFile(fullPath);
          const dirname = path.dirname(filePath);
          await sandbox.fs.mkdir(dirname, true);
          await sandbox.fs.writeFile(filePath, content, {
            create: true,
            overwrite: true,
          });
        }
        spinner.succeed("Files written to sandbox");

        spinner.start("Rebooting sandbox...");
        await sandbox.reboot();
        spinner.succeed("Sandbox rebooted");
      }

      const disposableStore = new DisposableStore();
      const handleProgress = async (progress: SetupProgress) => {
        if (progress.state === "IN_PROGRESS" && progress.steps.length > 0) {
          const step = progress.steps[progress.currentStepIndex];
          if (!step) {
            return;
          }

          const spinnerMessage = `Running setup: ${
            progress.currentStepIndex + 1
          } / ${progress.steps.length}: ${step.name}`;
          spinner.info(spinnerMessage);

          const shellId = step.shellId;

          if (shellId) {
            const shell = await sandbox.shells.open(shellId, {
              ptySize: {
                cols: process.stderr.columns,
                rows: process.stderr.rows,
              },
            });

            disposableStore.add(shell);
            disposableStore.add(
              shell.onOutput((data) => {
                process.stderr.write(data);
              })
            );
          }
        } else if (progress.state === "FINISHED") {
          spinner.succeed("Setup finished");
        } else if (progress.state === "STOPPED") {
          const step = progress.steps[progress.currentStepIndex];
          if (!step) {
            return;
          }

          if (step.finishStatus === "FAILED") {
            throw new Error(`Setup step failed: ${step.name}`);
          }
        }
      };

      const progress = await sandbox.setup.getProgress();
      await handleProgress(progress);
      disposableStore.add(sandbox.setup.onSetupProgressUpdate(handleProgress));

      await sandbox.setup.waitForFinish();

      disposableStore.dispose();
      spinner.succeed("Sandbox built");

      const tasksWithStart = (await sandbox.tasks.getTasks()).filter(
        (t) => t.runAtStart === true
      );
      let tasksWithPorts = tasksWithStart.filter((t) => t.preview?.port);

      const isMultipleTasks = tasksWithStart.length > 1;
      spinner.info(
        `Started ${tasksWithStart.length} ${
          isMultipleTasks ? "tasks" : "task"
        }: ${tasksWithStart.map((t) => t.name).join(", ")}`
      );

      const updatePortSpinner = () => {
        const isMultiplePorts = tasksWithPorts.length > 1;
        spinner.start(
          `Waiting for ${isMultiplePorts ? "ports" : "port"} ${tasksWithPorts
            .map((t) => t.preview?.port)
            .join(", ")} to open...`
        );
      };

      if (tasksWithPorts.length > 0) {
        updatePortSpinner();

        await Promise.all(
          tasksWithPorts.map(async (task) => {
            const port = task.preview?.port;
            if (!port) {
              return;
            }

            let timeout;
            const portInfo = await Promise.race([
              sandbox.ports.waitForPort(port),
              new Promise(
                (_, reject) =>
                  (timeout = setTimeout(
                    () =>
                      reject(
                        new Error(
                          `Waiting for port ${port} timed out after 60s`
                        )
                      ),
                    60000
                  ))
              ),
            ]);
            clearTimeout(timeout);

            if (!(portInfo instanceof PortInfo)) {
              throw portInfo;
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
              const res = await fetch(portInfo.getPreviewUrl());
              if (res.status < 400) {
                spinner.succeed(`Port ${port} is open (status ${res.status})`);
                break;
              } else {
                spinner.fail(
                  `Port ${port} is not open yet (status ${res.status}), retrying in 1 second...`
                );
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }

            tasksWithPorts = tasksWithPorts.filter((t) => t.id !== task.id);
            updatePortSpinner();
          })
        );

        spinner.succeed("All ports are open");
      }

      spinner.start("Creating memory snapshot...");
      await sandbox.hibernate();
      spinner.succeed(
        "Snapshot created, you can use this sandbox id as your template:"
      );

      // eslint-disable-next-line no-console
      console.log(sandbox.id);
    } catch (error) {
      spinner.fail(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
      process.exit(1);
    }
  },
};

async function getOrCreateSandbox(
  apiClient: Client,
  shaTag: string,
  force = false
): Promise<{
  alreadyExists: boolean;
  sandboxId: string;
}> {
  if (!force) {
    const res = handleResponse(
      await sandboxList({
        query: {
          page_size: 1,
          tags: shaTag,
        },
        client: apiClient,
      }),
      "Failed to get sandboxes from API"
    );

    if (res.sandboxes.length > 0) {
      return { alreadyExists: true, sandboxId: res.sandboxes[0].id };
    }
  }

  const sandbox = handleResponse(
    await sandboxCreate({
      client: apiClient,
      body: {
        files: {},
        privacy: 1,
        tags: ["sdk", shaTag],
        path: "/SDK-Templates",
        runtime: "vm",
        is_frozen: true,
      },
    }),
    "Failed to create sandbox"
  );

  return { alreadyExists: false, sandboxId: sandbox.id };
}