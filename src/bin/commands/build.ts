import { promises as fs } from "fs";
import path from "path";
import { isBinaryFile } from "isbinaryfile";
import readline from "readline";

import { Disposable, DisposableStore } from "@codesandbox/pitcher-common";
import { createClient, createConfig, type Client } from "@hey-api/client-fetch";
import ora from "ora";
import type * as yargs from "yargs";

import { VMTier, CodeSandbox, Sandbox, SetupProgress } from "../../";

import {
  sandboxCreate,
  sandboxFork,
  vmCreateTag,
  vmListClusters,
  VmUpdateSpecsRequest,
} from "../../api-clients/client";
import { getDefaultTemplateId, handleResponse } from "../../utils/api";
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

function createSpinnerFactory() {
  let currentLineIndex = 0;
  let currentSpinnerIndex = 0;

  return (prefix: string) => {
    const spinner = ora({ stream: process.stdout });
    const spinnerIndex = currentSpinnerIndex++;
    let lastMethod: string;

    function updateCursor(method: string) {
      readline.moveCursor(
        process.stdout,
        0,
        spinnerIndex - currentLineIndex + (lastMethod !== "start" ? -1 : 0)
      );
      currentLineIndex = spinnerIndex;
      lastMethod = method;
    }

    return {
      start(message: string) {
        updateCursor("start");
        spinner.start(`${prefix}: ${message}`);
      },
      succeed(message: string) {
        updateCursor("succeed");
        spinner.succeed(`${prefix}: ${message}`);
      },
      fail(message: string) {
        updateCursor("fail");
        spinner.fail(`${prefix}: ${message}`);
      },
      info(message: string) {
        updateCursor("info");
        spinner.info(`${prefix}: ${message}`);
      },
    };
  };
}

export const buildCommand: yargs.CommandModule<
  Record<string, never>,
  BuildCommandArgs
> = {
  command: "build <directory>",
  describe:
    "Build an efficient memory snapshot from a directory. This snapshot can be used to create sandboxes quickly.",
  builder: (yargs: yargs.Argv) =>
    yargs
      .option("from-sandbox", {
        describe: "Use and update an existing sandbox as a template",
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

    const createSpinner = createSpinnerFactory();

    try {
      const clustersData = handleResponse(
        await vmListClusters({
          client: apiClient,
        }),
        "Failed to list clusters"
      );

      const clusters = clustersData.clusters;

      const sandboxIds = await Promise.all(
        clusters.map(async ({ host: cluster }) => {
          const sdk = new CodeSandbox(API_KEY, {
            baseUrl: BASE_URL,
            headers: {
              "x-pitcher-manager-url": `https://${cluster}/api/v1`,
            },
          });
          const spinner = createSpinner(`${cluster}`);

          try {
            const { hash, files: filePaths } = await hashDirectory(
              argv.directory
            );
            spinner.succeed(`Indexed ${filePaths.length} files`);
            const shortHash = hash.slice(0, 6);
            const tag = `sha:${shortHash}-${cluster || ""}`;

            spinner.start(`Creating sandbox...`);
            const sandboxId = await createSandbox({
              apiClient,
              shaTag: tag,
              fromSandbox: argv.fromSandbox,
              collectionPath: argv.path,
              name: argv.name,
              vmTier: argv.vmTier ? VMTier.fromName(argv.vmTier) : undefined,
            });

            spinner.start(`Starting sandbox... `);

            const startResponse = await sdk.sandbox["start"](sandboxId, {
              vmTier: argv.vmTier ? VMTier.fromName(argv.vmTier) : undefined,
            });
            const sandbox = new Sandbox(sandboxId, startResponse, apiClient);
            const session = await sandbox.connect();

            spinner.start("Writing files to sandbox...");
            let i = 0;
            for (const filePath of filePaths) {
              i++;
              const fullPath = path.join(argv.directory, filePath);
              const content = await fs.readFile(fullPath);
              const dirname = path.dirname(filePath);
              await session.fs.mkdir(dirname, true);
              await session.fs.writeFile(filePath, content, {
                create: true,
                overwrite: true,
              });
            }

            spinner.start("Restarting sandbox...");
            await sdk.sandbox.restart(sandbox.id);

            const disposableStore = new DisposableStore();
            const handleProgress = async (progress: SetupProgress) => {
              if (
                progress.state === "IN_PROGRESS" &&
                progress.steps.length > 0
              ) {
                const step = progress.steps[progress.currentStepIndex];
                if (!step) {
                  return;
                }

                const spinnerMessage = `Running setup: ${
                  progress.currentStepIndex + 1
                } / ${progress.steps.length}: ${step.name}...`;
                spinner.start(spinnerMessage);

                const shellId = step.shellId;

                if (shellId) {
                  const shell = await session.shells.open(shellId, {
                    ptySize: {
                      cols: process.stderr.columns,
                      rows: process.stderr.rows,
                    },
                  });

                  disposableStore.add(Disposable.create(() => shell.kill()));
                  disposableStore.add(
                    shell.onOutput((data) => {
                      process.stderr.write(data);
                    })
                  );
                }
              } else if (progress.state === "STOPPED") {
                const step = progress.steps[progress.currentStepIndex];
                if (!step) {
                  return;
                }

                if (step.finishStatus === "FAILED") {
                  spinner.fail(`Setup step failed: ${step.name}`);
                  throw new Error(`Setup step failed: ${step.name}`);
                }
              }
            };

            const progress = await session.setup.getProgress();
            await handleProgress(progress);
            disposableStore.add(
              session.setup.onSetupProgressUpdate(handleProgress)
            );

            await session.setup.waitForFinish();

            disposableStore.dispose();
            const tasksWithStart = (await session.tasks.getTasks()).filter(
              (t) => t.runAtStart === true
            );
            let tasksWithPorts = tasksWithStart.filter((t) => t.preview?.port);

            const updatePortSpinner = () => {
              const isMultiplePorts = tasksWithPorts.length > 1;
              spinner.start(
                `Waiting for ${
                  isMultiplePorts ? "ports" : "port"
                } ${tasksWithPorts
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
                    session.ports.waitForPort(port),
                    new Promise<Error>(
                      (resolve) =>
                        (timeout = setTimeout(
                          () =>
                            resolve(
                              new Error(
                                `Waiting for port ${port} timed out after 60s`
                              )
                            ),
                          60000
                        ))
                    ),
                  ]);
                  clearTimeout(timeout);

                  if (portInfo instanceof Error) {
                    throw portInfo;
                  }

                  // eslint-disable-next-line no-constant-condition
                  while (true) {
                    const res = await fetch("https://" + portInfo.url);
                    if (res.status !== 502 && res.status !== 503) {
                      break;
                    }

                    await new Promise((resolve) => setTimeout(resolve, 1000));
                  }

                  tasksWithPorts = tasksWithPorts.filter(
                    (t) => t.id !== task.id
                  );
                  updatePortSpinner();
                })
              );
            } else {
              spinner.start(
                "No ports to open, waiting 5 seconds for tasks to run..."
              );
              await new Promise((resolve) => setTimeout(resolve, 5000));
            }

            spinner.start("Creating memory snapshot...");
            await sdk.sandbox.hibernate(sandbox.id);
            spinner.succeed("Snapshot created");

            return sandbox.id;
          } catch (error) {
            spinner.fail(
              error instanceof Error ? error.message : "Unknown error occurred"
            );
            throw error;
          }
        })
      );

      const data = handleResponse(
        await vmCreateTag({
          client: apiClient,
          body: {
            vm_ids: sandboxIds,
          },
        }),
        "Failed to create tag"
      );
      console.log("Tag created: " + data.tag_id);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  },
};

type CreateSandboxParams = {
  apiClient: Client;
  shaTag: string;
  fromSandbox?: string;
  collectionPath?: string;
  name?: string;
  vmTier?: VMTier;
  ipcountry?: string;
};

async function createSandbox({
  apiClient,
  shaTag,
  collectionPath,
  fromSandbox,
  name,
}: CreateSandboxParams) {
  const sanitizedCollectionPath = collectionPath
    ? collectionPath.startsWith("/")
      ? collectionPath
      : `/${collectionPath}`
    : "/SDK-Templates";

  const sandbox = handleResponse(
    await sandboxFork({
      client: apiClient,
      path: {
        id: fromSandbox || getDefaultTemplateId(apiClient),
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

  return sandbox.id;
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
