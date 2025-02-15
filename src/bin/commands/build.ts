import { promises as fs } from "fs";
import path from "path";
import { isBinaryFile } from "isbinaryfile";

import { DisposableStore } from "@codesandbox/pitcher-common";
import { createClient, createConfig, type Client } from "@hey-api/client-fetch";
import ora from "ora";
import type * as yargs from "yargs";

import { SetupProgress, VMTier } from "../../";
import { CodeSandbox, PortInfo } from "../../";
import { sandboxCreate, sandboxFork, VmUpdateSpecsRequest } from "../../client";
import { handleResponse } from "../../utils/handle-response";
import { BASE_URL, getApiKey } from "../utils/constants";
import { hashDirectory } from "../utils/hash";

export type BuildCommandArgs = {
  directory: string;
  name?: string;
  path?: string;
  ipCountry?: string;
  fromSandbox?: string;
  skipFiles?: boolean;
  cluster?: string;
  vmTier?: VmUpdateSpecsRequest["tier"];
};

export const buildCommand: yargs.CommandModule<
  Record<string, never>,
  BuildCommandArgs
> = {
  command: "build <directory>",
  describe:
    "Build an efficient memory snapshot from a directory. This snapshot can be used to create sandboxes quickly.",
  builder: (yargs: yargs.Argv) =>
    yargs
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
      .option("name", {
        describe: "Name for the resulting sandbox that will serve as snapshot",
        type: "string",
      })
      .option("path", {
        describe:
          "Which folder (in the dashboard) the sandbox will be created in",
        default: "SDK-Templates",
        type: "string",
      })
      .option("vm-tier", {
        describe: "Base specs to use for the template sandbox",
        type: "string",
        choices: VMTier.All.map((t) => t.name),
      })
      .positional("directory", {
        describe: "Path to the project that we'll create a snapshot from",
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
      const { hash, files: filePaths } = await hashDirectory(argv.directory);
      spinner.succeed(`Indexed ${filePaths.length} files`);
      const shortHash = hash.slice(0, 6);
      const tag = `sha:${shortHash}-${cluster || ""}`;

      spinner.start(`Creating or updating sandbox...`);
      const { sandboxId, filesIncluded } = await createSandbox(
        apiClient,
        tag,
        filePaths,
        argv.directory,
        argv.fromSandbox,
        argv.path,
        argv.name
      );

      if (argv.fromSandbox) {
        spinner.succeed(
          `Created sandbox from template (${argv.fromSandbox}): ${sandboxId}`
        );
      } else {
        spinner.succeed(`Sandbox created: ${sandboxId}`);
      }

      if (argv.cluster) {
        spinner.start(`Starting sandbox in cluster ${argv.cluster}...`);
      } else {
        spinner.start(`Starting sandbox...`);
      }

      const sandbox = await sdk.sandbox.open(sandboxId, {
        ipcountry: argv.ipCountry,
        vmTier: argv.vmTier ? VMTier.fromName(argv.vmTier) : undefined,
      });
      spinner.succeed("Sandbox opened");

      if (!argv.skipFiles && !filesIncluded) {
        spinner.start("Writing files to sandbox...");
        let i = 0;
        for (const filePath of filePaths) {
          i++;
          spinner.start(`Writing file ${i} of ${filePaths.length}...`);
          const fullPath = path.join(argv.directory, filePath);
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
      } else {
        spinner.succeed(
          "No ports to open, waiting 5 seconds for tasks to run..."
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
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

async function createSandbox(
  apiClient: Client,
  shaTag: string,
  filePaths: string[],
  rootPath: string,
  fromSandbox?: string,
  collectionPath?: string,
  name?: string
): Promise<{
  sandboxId: string;
  filesIncluded: boolean;
}> {
  // Include the files in the sandbox if there are no binary files and there are 30 or less files
  const files = await getFiles(filePaths, rootPath);

  const sanitizedCollectionPath = collectionPath
    ? collectionPath.startsWith("/")
      ? collectionPath
      : `/${collectionPath}`
    : "/SDK-Templates";

  if (fromSandbox) {
    const sandbox = handleResponse(
      await sandboxFork({
        client: apiClient,
        path: {
          id: fromSandbox,
        },
        body: {
          title: name,
          privacy: 1,
          tags: ["sdk", shaTag],
          path: sanitizedCollectionPath,
        },
      }),
      "Failed to fork sandbox"
    );

    return {
      sandboxId: sandbox.id,
      filesIncluded: false,
    };
  }

  const sandbox = handleResponse(
    await sandboxCreate({
      client: apiClient,
      body: {
        title: name,
        files,
        privacy: 1,
        tags: ["sdk", shaTag],
        path: sanitizedCollectionPath,
        runtime: "vm",
        is_frozen: true,
      },
    }),
    "Failed to create sandbox"
  );

  return {
    sandboxId: sandbox.id,
    filesIncluded: Object.keys(files).length > 0,
  };
}

async function getFiles(
  filePaths: string[],
  rootPath: string
): Promise<Record<string, { code: string }>> {
  if (filePaths.length > 30) {
    return {};
  }

  let hasBinaryFile = false;
  const files: Record<string, { code: string }> = {};
  await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await fs.readFile(path.join(rootPath, filePath));

      if (await isBinaryFile(content)) {
        hasBinaryFile = true;
      }

      files[filePath] = { code: content.toString() };
    })
  );

  if (hasBinaryFile) {
    return {};
  }

  return files;
}
