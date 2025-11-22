import { promises as fs } from "fs";
import path from "path";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { spawn } from "child_process";
import { tmpdir } from "os";

export async function isDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn("docker", ["--version"]);
    process.on("close", (code) => {
      resolve(code === 0);
    });
    process.on("error", () => {
      resolve(false);
    });
  });
}

export async function findDockerfile(
  templateDirectory: string
): Promise<{ exists: boolean; path: string | null; inCodesandbox: boolean }> {
  // Check root directory
  const rootDockerfilePath = path.join(templateDirectory, "Dockerfile");
  try {
    await fs.access(rootDockerfilePath);
    return { exists: true, path: rootDockerfilePath, inCodesandbox: false };
  } catch {
    // Check .codesandbox directory
    const codesandboxDockerfilePath = path.join(
      templateDirectory,
      ".codesandbox",
      "Dockerfile"
    );
    try {
      await fs.access(codesandboxDockerfilePath);
      return {
        exists: true,
        path: codesandboxDockerfilePath,
        inCodesandbox: true,
      };
    } catch {
      return { exists: false, path: null, inCodesandbox: false };
    }
  }
}

export async function createTemporaryDockerfile(
  templateDirectory: string,
  existingDockerfilePath: string | null
): Promise<string> {
  // Create a temporary directory for the Dockerfile
  const tmpDir = await mkdtemp(path.join(tmpdir(), "csb-docker-"));
  const tmpDockerfilePath = path.join(tmpDir, "Dockerfile");

  let dockerfileContent = "";

  if (existingDockerfilePath) {
    // Read existing Dockerfile from .codesandbox
    dockerfileContent = await fs.readFile(existingDockerfilePath, "utf-8");
    dockerfileContent += "\n\n# Added by CodeSandbox SDK\n";
  } else {
    // Create a new Dockerfile with node:24 base
    dockerfileContent = "FROM node:24\n\n";
  }

  // Add COPY command to copy files into /workspace
  dockerfileContent += "WORKDIR /workspace\nCOPY . /workspace\n";

  await writeFile(tmpDockerfilePath, dockerfileContent);

  return tmpDockerfilePath;
}

export type DockerBuildOptions = {
  dockerfilePath: string;
  imageName: string;
  context: string;
  architecture?: string;
  onOutput?: (output: string) => void;
};

export async function buildDockerImage(options: DockerBuildOptions): Promise<void> {
  const { dockerfilePath, imageName, context, architecture = "amd64", onOutput = () => { } } = options;


  await new Promise<void>((resolve, reject) => {
    const dockerProcess = spawn(
      "docker",
      [
        "build",
        "--platform",
        `linux/${architecture}`,
        "--no-cache",
        "--progress=plain",
        "-f",
        dockerfilePath,
        "-t",
        imageName,
        context,
      ],
      {
        stdio: ["inherit", "pipe", "pipe"],
      }
    );

    let outputBuffer = "";

    dockerProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
      // Update spinner with latest output line
      const lines = output.trim().split("\n");
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        onOutput(lastLine);
      }
    });

    dockerProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
      // Print stderr to console as well
      const lines = output.trim().split("\n");
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        onOutput(lastLine);
      }
    });

    dockerProcess.on("close", (code) => {
      if (code === 0) {
        onOutput(`Docker image built successfully: ${imageName}`);
        resolve();
      } else {
        reject(
          new Error(`Docker build failed with exit code ${code}\n${outputBuffer}`)
        );
      }
    });

    dockerProcess.on("error", (error) => {
      reject(`Docker build failed: ${error.message}`);
    });
  });

}

export async function pushDockerImage(imageName: string, onOutput?: (output: string) => void): Promise<void> {

  onOutput = onOutput || (() => { });

  await new Promise<void>((resolve, reject) => {
    const pushProcess = spawn(
      "docker",
      ["push", imageName],
      {
        stdio: ["inherit", "pipe", "pipe"],
      }
    );

    let outputBuffer = "";

    pushProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
      // Update spinner with latest output line
      const lines = output.trim().split("\n");
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        onOutput(lastLine);
      }
    });

    pushProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
      // Print stderr to console as well
      const lines = output.trim().split("\n");
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        onOutput(lastLine);
      }
    });

    pushProcess.on("close", (code) => {
      if (code === 0) {
        onOutput(`Docker image pushed successfully: ${imageName}`);
        resolve();
      } else {
        reject(
          new Error(`Docker push failed with exit code ${code}\n${outputBuffer}`)
        );
      }
    });

    pushProcess.on("error", (error) => {
      reject(`Docker push failed: ${error.message}`);
    });
  });
}

/**
 * Prepares the Docker build environment for building a Docker image for a CodeSandbox template.
 * 
 * @param directory Directory where csb build is called on
 * @param onOutput Optional output callback for logging
 * @returns A cleanup function to remove temporary Dockerfile if created
 */
export async function prepareDockerBuild(directory: string, onOutput?: (output: string) => void): Promise<{ dockerfilePath: string, cleanupFn: () => Promise<void> }> {

  onOutput = onOutput || (() => { });

  const dockerAvailable = await isDockerAvailable();
  if (!dockerAvailable) {
    console.error(
      "Docker is not available. Please install Docker to use beta build mode."
    );
    process.exit(1);
  }

  onOutput("Checking for Dockerfile...");

  const dockerfileInfo = await findDockerfile(directory);
  let dockerfilePath: string;
  let needsCleanup = false;
  let tmpDockerfilePath: string | null = null;

  if (!dockerfileInfo.exists || dockerfileInfo.inCodesandbox) {
    onOutput("Creating temporary Dockerfile...");
    tmpDockerfilePath = await createTemporaryDockerfile(
      directory,
      dockerfileInfo.path
    );
    dockerfilePath = tmpDockerfilePath;
    needsCleanup = true;
  } else {
    dockerfilePath = dockerfileInfo.path!;
  }

  return {
    dockerfilePath,
    cleanupFn: async () => {
      if (needsCleanup && tmpDockerfilePath) {
        onOutput("Cleaning up temporary Dockerfile...");
        const tmpDir = path.dirname(tmpDockerfilePath);
        await rm(tmpDir, { recursive: true, force: true });
      }
    }
  }
}