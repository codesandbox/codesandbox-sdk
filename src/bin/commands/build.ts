import { promises as fs } from "fs";
import path, { dirname } from "path";
import * as readline from "readline";
import ora from "ora";
import type * as yargs from "yargs";
import { instrumentedFetch } from "../utils/sentry";
import {
  VMTier,
  CodeSandbox,
  Sandbox,
  SandboxClient,
  API,
} from "@codesandbox/sdk";
import { VmUpdateSpecsRequest } from "../../api-clients/client";
import { getDefaultTemplateId, retryWithDelay } from "../../utils/api";
import { getInferredApiKey } from "../../utils/constants";
import { hashDirectory as getFilePaths } from "../utils/files";
import { mkdir, writeFile } from "fs/promises";
import { sleep } from "../../utils/sleep";

export type BuildCommandArgs = {
  directory: string;
  name?: string;
  path?: string;
  alias?: string;
  ports?: number[];
  ci: boolean;
  fromSandbox?: string;
  skipFiles?: boolean;
  vmTier?: VmUpdateSpecsRequest["tier"];
  vmBuildTier?: VmUpdateSpecsRequest["tier"];
  logPath?: string;
};

async function writeFileEnsureDir(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

async function hasDockerfile(templateDirectory: string): Promise<boolean> {
  try {
    const dockerfilePath = path.join(
      templateDirectory,
      ".codesandbox",
      "Dockerfile"
    );
    await fs.access(dockerfilePath);
    return true;
  } catch {
    return false;
  }
}

async function removeDevcontainerFiles(session: SandboxClient): Promise<void> {
  try {
    // Check if .devcontainer directory exists
    const devcontainerPath = ".devcontainer";
    try {
      await session.fs.stat(devcontainerPath);
      // If we reach here, the directory exists, so remove it
      await session.fs.remove(devcontainerPath, true);
    } catch {
      // Directory doesn't exist, nothing to remove
    }
  } catch (error) {
    // Log but don't fail the build if devcontainer cleanup fails
    console.warn(`Warning: Failed to remove .devcontainer files: ${error}`);
  }
}

function stripAnsiCodes(str: string) {
  // Matches ESC [ params … finalChar
  //   \x1B       = ESC
  //   \[         = literal “[”
  //   [0-?]*     = any parameter bytes (digits, ;, ?)
  //   [ -/]*     = any intermediate bytes (space through /)
  //   [@-~]      = final byte ( @ A–Z [ \ ] ^ _ ` a–z { | } ~ )
  const CSI_REGEX = /\x1B\[[0-?]*[ -/]*[@-~]/g;
  return str.replace(CSI_REGEX, "");
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
      .option("ports", {
        describe: "Ports to wait for to open before creating snapshot",
        type: "number",
        array: true,
      })
      .option("vm-tier", {
        describe: "Base specs to use for the template sandbox",
        type: "string",
        choices: VMTier.All.map((t) => t.name),
      })
      .option("vm-build-tier", {
        describe: "Specs to use for building the template sandbox.",
        type: "string",
        choices: VMTier.All.map((t) => t.name),
      })
      .option("alias", {
        describe:
          "Alias that should point to the created template. Alias namespace defaults to template directory, but you can explicitly pass `namespace@alias`",
        type: "string",
      })
      .option("ci", {
        describe: "CI mode, will exit process if any error occurs",
        default: false,
        type: "boolean",
      })
      .option("log-path", {
        describe: "Relative path to log file, if any",
        type: "string",
      })
      .positional("directory", {
        describe: "Path to the project that we'll create a snapshot from",
        type: "string",
        demandOption: "Path to the project is required",
      })
      .check((argv) => {
        // Validate ports parameter - ensure all values are valid numbers
        if (argv.ports && argv.ports.length > 0) {
          const invalidPortsWithOriginal: string[] = [];

          // Get the original arguments to show what the user actually typed
          const originalArgs = process.argv;
          const portArgIndices: number[] = [];

          // Find all --ports arguments in the original command
          originalArgs.forEach((arg, i) => {
            if (arg === "--ports" && i + 1 < originalArgs.length) {
              portArgIndices.push(i + 1);
            }
          });

          argv.ports.forEach((port, i) => {
            const isInvalid =
              !Number.isInteger(port) ||
              port <= 0 ||
              port > 65535 ||
              !Number.isFinite(port);

            if (isInvalid) {
              // Try to get the original input, fallback to the parsed value
              const originalInput = portArgIndices[i]
                ? originalArgs[portArgIndices[i]]
                : String(port);
              invalidPortsWithOriginal.push(originalInput);
            }
          });

          if (invalidPortsWithOriginal.length > 0) {
            throw new Error(
              `Invalid port value(s): ${invalidPortsWithOriginal.join(
                ", "
              )}. Ports must be integers between 1 and 65535.`
            );
          }
        }
        return true;
      }),

  handler: async (argv) => {
    const apiKey = getInferredApiKey();
    const api = new API({ apiKey, instrumentation: instrumentedFetch });
    const sdk = new CodeSandbox(apiKey);
    const sandboxTier = argv.vmTier
      ? VMTier.fromName(argv.vmTier)
      : VMTier.Micro;
    const buildTier = argv.vmBuildTier
      ? VMTier.fromName(argv.vmBuildTier)
      : sandboxTier;

    let alias: { namespace: string; alias: string } | undefined;

    if (argv.alias) {
      alias = createAlias(path.resolve(argv.directory), argv.alias);
    }

    const filePaths = await getFilePaths(argv.directory);

    try {
      const templateData = await api.createTemplate({
        forkOf: argv.fromSandbox || getDefaultTemplateId(api.getClient()),
        title: argv.name,
        // We filter out sdk-templates on the dashboard
        tags: ["sdk-template"],
      });

      const spinner = ora({ stream: process.stdout });
      let spinnerMessages: string[] = templateData.sandboxes.map(() => "");

      function updateSpinnerMessage(index: number, message: string) {
        spinnerMessages[
          index
        ] = `[cluster: ${templateData.sandboxes[index].cluster}, sandboxId: ${templateData.sandboxes[index].id}]: ${message}`;

        return `\n${spinnerMessages.join("\n")}`;
      }

      const waitForSetup = async (sandbox: SandboxClient, index: number) => {
        const steps = await sandbox.setup.getSteps();

        for (const step of steps) {
          const buffer: string[] = [];

          try {
            // Check if this is a container setup step and handle it specially
            const isContainerStep = step.name
              .toLowerCase()
              .includes("starting container");

            if (isContainerStep) {
              spinner.start(
                updateSpinnerMessage(
                  index,
                  `Building and starting container...`
                )
              );
            } else {
              spinner.start(
                updateSpinnerMessage(
                  index,
                  `Running setup ${steps.indexOf(step) + 1} / ${
                    steps.length
                  } - ${step.name}...`
                )
              );
            }

            step.onOutput((output) => {
              const cleanOutput = stripAnsiCodes(output);

              buffer.push(cleanOutput);

              // For container steps, update spinner with current log line
              if (isContainerStep && cleanOutput.trim()) {
                const currentLogLine = cleanOutput.trim();
                const logPreview =
                  currentLogLine.length > 100
                    ? currentLogLine.slice(0, 100) + "..."
                    : currentLogLine;

                spinner.start(
                  updateSpinnerMessage(
                    index,
                    `Building and starting container (${logPreview})...`
                  )
                );
              }
            });

            const output = await step.open();

            buffer.push(...output.split("\n").map(stripAnsiCodes));

            await step.waitUntilComplete();
          } catch (error) {
            const logPath = argv.logPath || process.cwd();
            const timestamp = new Date().toISOString().replace(/:/g, "-");
            const logFilename = path.join(
              logPath,
              `setup-failure-${sandbox.id}-${timestamp}.log`
            );

            try {
              await writeFileEnsureDir(logFilename, buffer.join("\n"));
              console.error(`Log saved to: ${logFilename}`);
            } catch (writeError) {
              console.error(`Failed to write log file: ${writeError}`);
            }

            throw new Error(`Setup step failed: ${step.name}`);
          }
        }
      };

      const tasks = templateData.sandboxes.map(async ({ id }, index) => {
        let currentSession: SandboxClient | null = null;
        try {
          spinner.start(updateSpinnerMessage(index, "Starting sandbox..."));

          const startResponse = await withCustomError(
            api.startVm(id, { retryDelay: 200 }),
            "Failed to start sandbox at all"
          );
          let sandboxVM = new Sandbox(id, api, startResponse);

          let session = await sandboxVM.connect();
          currentSession = session;

          spinner.start(
            updateSpinnerMessage(index, "Writing files to sandbox...")
          );

          // Use batch write for more efficient file uploads
          await retryWithDelay(
            async () => {
              const files = await Promise.all(
                filePaths.map(async (filePath) => {
                  const fullPath = path.join(argv.directory, filePath);
                  const content = await fs.readFile(fullPath);
                  return {
                    path: filePath,
                    content,
                  };
                })
              );
              await session.fs.batchWrite(files);
            },
            3,
            200
          ).catch((error) => {
            throw new Error(`Failed to write files to sandbox: ${error}`);
          });

          // Check if template has .codesandbox/Dockerfile and remove .devcontainer files if so
          if (await hasDockerfile(argv.directory)) {
            spinner.start(
              updateSpinnerMessage(index, "Configuring Docker file...")
            );
            await removeDevcontainerFiles(session);
          }

          // Dispose of the session after writing files to prevent reconnection
          session.dispose();
          currentSession = null;

          spinner.start(updateSpinnerMessage(index, "Building sandbox..."));

          sandboxVM = await withCustomError(
            sdk.sandboxes.restart(id, {
              vmTier: buildTier,
            }),
            "Failed to restart sandbox after building"
          );

          session = await withCustomError(
            sandboxVM.connect(),
            "Failed to connect to sandbox after building"
          );
          currentSession = session;

          await waitForSetup(session, index);

          // Dispose of the session after setup to prevent reconnection
          session.dispose();
          currentSession = null;

          spinner.start(
            updateSpinnerMessage(index, "Optimizing initial state...")
          );
          sandboxVM = await withCustomError(
            sdk.sandboxes.restart(id, {
              vmTier: sandboxTier,
            }),
            "Failed to restart sandbox after optimizing initial state"
          );

          session = await withCustomError(
            sandboxVM.connect(),
            "Failed to connect to sandbox after optimizing initial state"
          );
          currentSession = session;

          await waitForSetup(session, index);

          const ports = argv.ports || [];
          const updatePortSpinner = () => {
            const isMultiplePorts = ports.length > 1;
            spinner.start(
              updateSpinnerMessage(
                index,
                `Waiting for ${isMultiplePorts ? "ports" : "port"} ${ports.join(
                  ", "
                )} to open...`
              )
            );
          };

          if (ports.length > 0) {
            updatePortSpinner();

            await Promise.all(
              ports.map(async (port) => {
                const portInfo = await session.ports.waitForPort(port, {
                  timeoutMs: 60000,
                });

                // eslint-disable-next-line no-constant-condition
                while (true) {
                  const res = await fetch("https://" + portInfo.host);
                  if (res.status !== 502 && res.status !== 503) {
                    break;
                  }

                  await sleep(1000);
                }

                updatePortSpinner();
              })
            );
          } else {
            spinner.start(
              updateSpinnerMessage(
                index,
                "No ports to open, waiting 5 seconds for tasks to run..."
              )
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }

          // Dispose of the session after port operations to prevent reconnection
          session.dispose();
          currentSession = null;

          spinner.start(updateSpinnerMessage(index, "Creating snapshot..."));
          await withCustomError(
            sdk.sandboxes.hibernate(id),
            "Failed to hibernate after building and optimizing sandbox"
          );
          spinner.start(updateSpinnerMessage(index, "Snapshot created"));

          return id;
        } catch (error) {
          // Dispose of any active session to prevent reconnection attempts
          if (currentSession) {
            currentSession.dispose();
            currentSession = null;
          }

          spinner.start(
            updateSpinnerMessage(
              index,
              argv.ci
                ? String(error)
                : "Failed, please manually verify at https://codesandbox.io/s/" +
                    id +
                    " - " +
                    String(error)
            )
          );

          throw error;
        }
      });

      if (argv.ci) {
        try {
          await Promise.all(tasks);
        } catch {
          spinner.fail(`\n${spinnerMessages.join("\n")}`);
          process.exit(1);
        }
      } else {
        const results = await Promise.allSettled(tasks);

        const failedSandboxes = templateData.sandboxes.filter(
          (_, index) => results[index].status === "rejected"
        );

        if (failedSandboxes.length > 0) {
          spinner.start(
            `\n${spinnerMessages.join(
              "\n"
            )}\n\nThere was an issue preparing the sandboxes. Verify ${failedSandboxes
              .map((sandbox) => sandbox.id)
              .join(", ")} and press ENTER to create snapshot...\n`
          );

          await waitForEnter();

          failedSandboxes.forEach(({ id }) => {
            updateSpinnerMessage(
              templateData.sandboxes.findIndex((sandbox) => sandbox.id === id),
              "Creating snapshot..."
            );
          });

          spinner.start(`\n${spinnerMessages.join("\n")}`);

          await Promise.all(
            failedSandboxes.map(async ({ id }) => {
              await sdk.sandboxes.hibernate(id);

              spinner.start(
                updateSpinnerMessage(
                  templateData.sandboxes.findIndex(
                    (sandbox) => sandbox.id === id
                  ),
                  "Snapshot created"
                )
              );
            })
          );
          spinner.start(`\n${spinnerMessages.join("\n")}`);
        } else {
          spinner.start(`\n${spinnerMessages.join("\n")}`);
        }
      }

      spinner.start(
        `\n${spinnerMessages.join(
          "\n"
        )}\n\nCreating template reference and example...`
      );

      let referenceString;
      let id;

      if (alias) {
        await api.assignVmTagAlias(alias.namespace, alias.alias, {
          tag_id: templateData.tag,
        });

        id = `${alias.namespace}@${alias.alias}`;
        referenceString = `Alias ${id} now referencing: ${templateData.tag}`;
      } else {
        id = templateData.tag;
        referenceString = `Template created with tag: ${templateData.tag}`;
      }

      const sandbox = await sdk.sandboxes.create({
        id,
      });

      spinner.succeed(
        `\n${spinnerMessages.join("\n")}\n\n${referenceString}

sdk.sandboxes.create({
  id: "${id}"
})
  
Verify Sandbox at: https://codesandbox.io/s/${sandbox.id}\n\n`
      );

      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  },
};

function withCustomError<T extends Promise<any>>(promise: T, message: string) {
  return promise.catch((error) => {
    throw new Error(message + ": " + error.message);
  });
}

function waitForEnter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<void>((resolve) => {
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
}

function createAlias(directory: string, alias: string) {
  const aliasParts = alias.split("@");

  if (aliasParts.length > 2) {
    throw new Error(
      `Alias name "${alias}" is invalid, must be in the format of name@tag`
    );
  }

  const namespace =
    aliasParts.length === 2 ? aliasParts[0] : path.basename(directory);
  alias = aliasParts.length === 2 ? aliasParts[1] : alias;

  if (namespace.length > 64 || alias.length > 64) {
    throw new Error(
      `Alias name "${namespace}" or tag "${alias}" is too long, must be 64 characters or less`
    );
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(namespace) || !/^[a-zA-Z0-9-_]+$/.test(alias)) {
    throw new Error(
      `Alias name "${namespace}" or tag "${alias}" is invalid, must only contain upper/lower case letters, numbers, dashes and underscores`
    );
  }

  return {
    namespace,
    alias,
  };
}
