import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { readFile, stat, readdir } from "fs/promises";
import { join, relative } from "path";

import ignore from "ignore";

interface HashResult {
  hash: string;
  files: string[];
}

const MAX_FILES = 50_000;

export async function hashDirectory(dirPath: string): Promise<HashResult> {
  // Initialize ignore rules from .gitignore, .dockerignore and .csbignore
  const ig = ignore();
  const ignoreFiles = [".gitignore", ".dockerignore", ".csbignore"];
  ignoreFiles.forEach((file) => {
    const fullPath = join(dirPath, file);
    if (existsSync(fullPath)) {
      ig.add(readFileSync(fullPath, "utf8"));
      ig.add(file);
    }
  });

  // Always ignore .git folder
  ig.add(".git/**");

  const relevantFiles: string[] = [];
  const fileHashes: string[] = [];

  async function processDirectory(currentPath: string) {
    const files = await readdir(currentPath);
    await Promise.all(
      files.map(async (file) => {
        if (relevantFiles.length >= MAX_FILES) {
          throw new Error(`Directory contains more than ${MAX_FILES} files`);
        }

        const fullPath = join(currentPath, file);
        const relativePath = relative(dirPath, fullPath);

        // Skip if file is ignored
        if (ig.ignores(relativePath)) {
          return;
        }

        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          await processDirectory(fullPath);
        } else if (stats.isFile()) {
          const fileContent = await readFile(fullPath);
          const fileHash = createHash("sha256")
            .update(fileContent)
            .digest("hex");
          fileHashes.push(fileHash);
          relevantFiles.push(relativePath);
        }
      })
    );
  }

  await processDirectory(dirPath);

  // Sort for consistent hashing
  fileHashes.sort();
  relevantFiles.sort();

  // Create final hash from all file hashes
  const finalHash = createHash("sha256")
    .update(fileHashes.join(""))
    .digest("hex");

  return {
    hash: finalHash,
    files: relevantFiles,
  };
}
