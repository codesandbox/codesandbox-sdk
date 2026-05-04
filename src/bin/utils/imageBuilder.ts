import { createGzip } from "zlib";
import { promises as fs } from "fs";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { join } from "path";
import ignore from "ignore";

export interface ImageBuildOptions {
  /** Absolute path to the build context directory */
  contextDir: string;
  /** Image name (and optional tag), e.g. "my-image:latest" */
  imageName: string;
  /** Dockerfile content to inject at the root of the context (overrides any existing root Dockerfile) */
  dockerfileContent?: string;
  /** Callback for streaming build log lines */
  onOutput?: (line: string) => void;
}

/**
 * Client for the CodeSandbox hosted image-builder service.
 *
 * Workflow:
 *  1. Create a gzipped tar of the build context (respecting .dockerignore)
 *  2. POST multipart/form-data to /builds
 *  3. Stream SSE logs from /builds/{id}/logs until done
 *  4. Return the full image reference (e.g. "registry.host/namespace/name:tag")
 */
export class ImageBuilderClient {
  constructor(
    private readonly apiUrl: string,
    private readonly token: string
  ) {}

  async build(options: ImageBuildOptions): Promise<string> {
    const { contextDir, imageName, dockerfileContent, onOutput } = options;

    const tarGz = await createContextTarGz(contextDir, dockerfileContent);

    const formData = new FormData();
    formData.append(
      "context",
      new Blob([tarGz], { type: "application/gzip" }),
      "context.tar.gz"
    );
    formData.append("image_name", imageName);
    formData.append("dockerfile", "Dockerfile");
    formData.append("nydus_convert", "true");

    const response = await fetch(`${this.apiUrl}/builds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Image builder submit failed (${response.status}): ${body}`
      );
    }

    const { build_id } = (await response.json()) as { build_id: string };
    return this.streamUntilDone(build_id, onOutput);
  }

  private async streamUntilDone(
    buildId: string,
    onOutput?: (line: string) => void
  ): Promise<string> {
    const maxAttempts = 60;
    const retryDelayMs = 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.apiUrl}/builds/${buildId}/logs`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "text/event-stream",
          },
        });

        if (!response.ok) {
          if (response.status === 404 && attempt < maxAttempts) {
            await sleep(retryDelayMs);
            continue;
          }
          throw new Error(`Failed to get build logs (${response.status})`);
        }

        if (!response.body) {
          throw new Error("No response body from build logs stream");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            if (data.startsWith("{")) {
              let obj: Record<string, unknown>;
              try {
                obj = JSON.parse(data);
              } catch {
                continue;
              }
              if (obj["error"]) {
                throw new Error(`Build failed: ${obj["error"]}`);
              }
              if (obj["done"]) {
                const status = await this.getStatus(buildId);
                if (!status.image_ref) {
                  throw new Error("Build succeeded but image_ref is missing");
                }
                return status.image_ref;
              }
            } else if (data.trim() && onOutput) {
              onOutput(data);
            }
          }
        }

        // Stream ended without a done event — check status
        const status = await this.getStatus(buildId);
        if (status.status === "success" && status.image_ref) {
          return status.image_ref;
        }
        throw new Error(
          `Build stream ended unexpectedly (status: ${status.status})`
        );
      } catch (error) {
        if (attempt >= maxAttempts) throw error;
        await sleep(retryDelayMs);
      }
    }

    throw new Error("Image build timed out after maximum retry attempts");
  }

  private async getStatus(
    buildId: string
  ): Promise<{ status: string; image_ref: string }> {
    const response = await fetch(`${this.apiUrl}/builds/${buildId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to get build status (${response.status})`);
    }

    return response.json() as Promise<{ status: string; image_ref: string }>;
  }
}

/**
 * Parse a full image reference into its components.
 * e.g. "registry.host/namespace/name:tag" -> { registry, repository, name, tag }
 */
export function parseImageRef(imageRef: string): {
  registry: string;
  repository: string;
  name: string;
  tag: string;
} {
  const colonIdx = imageRef.lastIndexOf(":");
  const tag = colonIdx !== -1 ? imageRef.slice(colonIdx + 1) : "latest";
  const withoutTag = colonIdx !== -1 ? imageRef.slice(0, colonIdx) : imageRef;

  const parts = withoutTag.split("/");
  const registry = parts[0];
  const name = parts[parts.length - 1];
  const repository = parts.slice(1, -1).join("/");

  return { registry, repository, name, tag };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a gzipped tar buffer from a context directory.
 *
 * - Respects .gitignore, .dockerignore, .csbignore
 * - Always excludes .git
 * - If dockerfileContent is provided it is written as "Dockerfile" at the
 *   root of the archive (replacing any existing root Dockerfile entry).
 */
async function createContextTarGz(
  contextDir: string,
  dockerfileContent?: string
): Promise<Buffer> {
  // Collect ignore rules
  const ig = ignore();
  for (const file of [".gitignore", ".dockerignore", ".csbignore"]) {
    const fullPath = join(contextDir, file);
    if (existsSync(fullPath)) {
      ig.add(readFileSync(fullPath, "utf8"));
    }
  }
  ig.add("/.git/");

  const files = await collectFiles(contextDir, contextDir, ig);

  // Build tar entries
  const entries: Array<{ name: string; content: Buffer }> = [];

  // If we have a synthetic Dockerfile, it replaces any root Dockerfile
  const injectDockerfile = dockerfileContent !== undefined;

  for (const relPath of files) {
    if (injectDockerfile && relPath === "Dockerfile") continue;
    const content = await fs.readFile(join(contextDir, relPath));
    entries.push({ name: relPath, content });
  }

  if (injectDockerfile) {
    entries.unshift({
      name: "Dockerfile",
      content: Buffer.from(dockerfileContent as string, "utf8"),
    });
  }

  return gzipBuffer(buildTar(entries));
}

async function collectFiles(
  baseDir: string,
  currentDir: string,
  ig: ReturnType<typeof ignore>
): Promise<string[]> {
  const result: string[] = [];
  const entries = await fs.readdir(currentDir);

  for (const entry of entries) {
    const fullPath = join(currentDir, entry);
    const relPath = path.relative(baseDir, fullPath);

    if (ig.ignores(relPath)) continue;

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      result.push(...(await collectFiles(baseDir, fullPath, ig)));
    } else if (stat.isFile()) {
      result.push(relPath);
    }
  }

  return result;
}

/** Create a POSIX tar buffer from an array of file entries. */
function buildTar(entries: Array<{ name: string; content: Buffer }>): Buffer {
  const chunks: Buffer[] = [];

  for (const { name, content } of entries) {
    const header = Buffer.alloc(512, 0);

    // Name field (100 bytes)
    header.write(name.slice(0, 100), 0, "utf8");
    // Mode
    header.write("0000644\0", 100, "utf8");
    // UID / GID
    header.write("0000000\0", 108, "utf8");
    header.write("0000000\0", 116, "utf8");
    // Size (octal, 11 digits + null)
    header.write(
      content.length.toString(8).padStart(11, "0") + "\0",
      124,
      "utf8"
    );
    // Modification time
    header.write(
      Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + "\0",
      136,
      "utf8"
    );
    // Type flag: regular file
    header[156] = 0x30;
    // UStar magic
    header.write("ustar\0", 257, "utf8");
    header.write("00", 263, "utf8");

    // Checksum: fill field with spaces, compute sum, write back
    header.fill(0x20, 148, 156);
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "utf8");

    chunks.push(header, content);

    const pad = 512 - (content.length % 512);
    if (pad !== 512) chunks.push(Buffer.alloc(pad, 0));
  }

  // End-of-archive: two 512-byte zero blocks
  chunks.push(Buffer.alloc(1024, 0));

  return Buffer.concat(chunks);
}

function gzipBuffer(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const gz = createGzip();
    gz.on("data", (c: Buffer) => chunks.push(c));
    gz.on("end", () => resolve(Buffer.concat(chunks)));
    gz.on("error", reject);
    gz.write(input);
    gz.end();
  });
}
