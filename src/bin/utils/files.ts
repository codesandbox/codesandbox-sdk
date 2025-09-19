import { existsSync, readFileSync } from "fs";
import { stat, readdir } from "fs/promises";
import { join, relative } from "path";

import ignore from "ignore";

const MAX_FILES = 50_000;

export async function hashDirectory(dirPath: string): Promise<string[]> {
  // Initialize ignore rules from .gitignore, .dockerignore and .csbignore
  const ig = ignore();
  const ignoreFiles = [".gitignore", ".dockerignore", ".csbignore"];
  ignoreFiles.forEach((file) => {
    const fullPath = join(dirPath, file);
    if (existsSync(fullPath)) {
      ig.add(readFileSync(fullPath, "utf8"));
    }
  });

  // Always ignore root .git folder
  ig.add("/.git/");

  const relevantFiles: string[] = [];

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
          relevantFiles.push(relativePath);
        }
      })
    );
  }

  await processDirectory(dirPath);

  relevantFiles.sort();

  return relevantFiles;
}
