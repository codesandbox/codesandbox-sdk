/**
 * Files & Commands Benchmark
 *
 * Measures timing for file operations and command execution inside a sandbox.
 * Useful for comparing performance between the old infra (Pitcher) and new infra (Pint).
 *
 * File operations measured:
 *   - write_small_file          Write a small text file (~1 KB) via writeTextFile
 *   - write_large_text_file     Write a large text file (~10 MB) via writeTextFile
 *   - write_large_binary_file   Write a large binary file (~10 MB) via writeFile
 *   - read_small_file           Read the small file back
 *   - read_large_file           Read the large text file back
 *   - batch_write_relative  Write 50 small files via batchWrite with workspace-relative paths
 *   - batch_write_absolute  Write 50 small files via batchWrite with absolute /tmp paths
 *   - mkdir                 Create a nested directory tree
 *   - readdir               List directory contents
 *   - stat                  Stat a file
 *   - copy_file             Copy the small file
 *   - rename_file           Rename the copied file
 *   - remove_file           Remove the renamed file
 *
 * Command operations measured:
 *   - cmd_echo              Simple echo (baseline round-trip latency)
 *   - cmd_cpu_pi            CPU-intensive: compute π digits with python3
 *   - cmd_cpu_hash          CPU-intensive: sha256 of /dev/urandom (256 MB)
 *   - cmd_disk_write        Disk write: dd 256 MB to a temp file
 *   - cmd_disk_read         Disk read: dd 256 MB from the temp file
 *   - cmd_find              Filesystem traversal: find /usr -type f
 *
 * Usage:
 *   CSB_API_KEY=<key> CSB_TEMPLATE_ID=<id> npm run benchmark:files
 *   CSB_API_KEY=<key> CSB_TEMPLATE_ID=<id> CSB_ITERATIONS=10 npm run benchmark:files
 *
 * Environment Variables:
 *   CSB_API_KEY         CodeSandbox API key (required)
 *   CSB_TEMPLATE_ID     Template ID to fork from (required)
 *   CSB_BASE_URL        API base URL (default: https://api.codesandbox.io)
 *   CSB_ITERATIONS      Number of benchmark iterations (default: 5)
 */

import { test } from "vitest";
import { CodeSandbox, Sandbox } from "../../src/index.js";
import { SandboxClient, CommandError } from "../../src/SandboxClient/index.js";
import {
  BenchmarkState,
  createState,
  initSDK,
  printReport,
  recordSandbox,
  recordSandboxError,
  timeMs,
  tryCleanup,
} from "./utils.js";

// ---------------------------------------------------------------------------
// CLI / env argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const templateId = process.env.CSB_TEMPLATE_ID;
  const iterations = process.env.CSB_ITERATIONS
    ? parseInt(process.env.CSB_ITERATIONS, 10)
    : 5;

  if (!templateId) {
    throw new Error("CSB_TEMPLATE_ID environment variable is required.");
  }

  if (!process.env.CSB_API_KEY) {
    throw new Error("CSB_API_KEY environment variable is required.");
  }

  return { templateId, iterations };
}

// ---------------------------------------------------------------------------
// Operation names
// ---------------------------------------------------------------------------

const FILE_OPS = [
  "write_small_file",
  "write_large_text_file",
  "write_large_binary_file",
  "read_small_file",
  "read_large_file",
  "batch_write_relative",
  "batch_write_absolute",
  "mkdir",
  "readdir",
  "stat",
  "copy_file",
  "rename_file",
  "remove_file",
] as const;

const CMD_OPS = [
  "cmd_echo",
  "cmd_cpu_pi",
  "cmd_cpu_hash",
  "cmd_disk_write",
  "cmd_disk_read",
  "cmd_find",
] as const;

const ALL_OPS = [...FILE_OPS, ...CMD_OPS] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRandomBytes(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  let x = 0x12345678;
  for (let i = 0; i < size; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    buf[i] = x & 0xff;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Single benchmark iteration
// ---------------------------------------------------------------------------

async function runIteration(
  sdk: CodeSandbox,
  state: BenchmarkState,
  templateId: string,
  index: number
): Promise<void> {
  console.log(`\n── Iteration ${index + 1} ──────────────────────────────`);
  let sandbox: Sandbox | undefined;
  let client: SandboxClient | undefined;

  try {
    // ── create sandbox ────────────────────────────────────────────────────────
    console.log("  Creating sandbox...");
    let ms: number;
    try {
      [sandbox, ms] = await timeMs(() =>
        sdk.sandboxes.create({ id: templateId, tags: ["benchmark"] })
      );
      console.log(`  Created  ${(ms / 1000).toFixed(2)}s ✓  (id: ${sandbox.id})`);
    } catch (err) {
      console.log(`  Failed creating sandbox ✗  ${String(err)}`);
      return;
    }

    const sandboxId = sandbox.id;
    const benchDir = `/tmp/benchmark_${index}`;

    // ── connect ───────────────────────────────────────────────────────────────
    console.log("  Connecting...");
    try {
      client = await sandbox.connect();
    } catch (err) {
      console.log(`  Failed connecting ✗  ${String(err)}`);
      await tryCleanup(sdk, sandboxId);
      return;
    }

    const fs = client.fs;
    const commands = client.commands;

    // ── mkdir ─────────────────────────────────────────────────────────────────
    console.log("  mkdir...");
    try {
      [, ms] = await timeMs(() => fs.mkdir(benchDir, true));
      recordSandbox(state, sandboxId, "mkdir", ms);
      console.log(`  mkdir  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  mkdir ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "mkdir");
    }

    // ── write small file (~1 KB) ──────────────────────────────────────────────
    const smallPath = `${benchDir}/small.txt`;
    const smallContent = "x".repeat(1024); // 1 KB
    console.log("  write_small_file...");
    try {
      [, ms] = await timeMs(() => fs.writeTextFile(smallPath, smallContent));
      recordSandbox(state, sandboxId, "write_small_file", ms);
      console.log(`  write_small_file  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  write_small_file ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "write_small_file");
    }

    // ── write large text file (~10 MB via writeTextFile) ────────────────────
    const largePath = `${benchDir}/large.txt`;
    const largeTextContent = "x".repeat(10 * 1024 * 1024); // 10 MB
    console.log("  write_large_text_file...");
    try {
      [, ms] = await timeMs(() => fs.writeTextFile(largePath, largeTextContent));
      recordSandbox(state, sandboxId, "write_large_text_file", ms);
      console.log(`  write_large_text_file  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  write_large_text_file ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "write_large_text_file");
    }

    // ── write large binary file (~10 MB via writeFile) ───────────────────────
    const largeBinPath = `${benchDir}/large.bin`;
    const largeBinContent = makeRandomBytes(10 * 1024 * 1024); // 10 MB
    console.log("  write_large_binary_file...");
    try {
      [, ms] = await timeMs(() => fs.writeFile(largeBinPath, largeBinContent));
      recordSandbox(state, sandboxId, "write_large_binary_file", ms);
      console.log(`  write_large_binary_file  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  write_large_binary_file ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "write_large_binary_file");
    }

    // ── read small file ───────────────────────────────────────────────────────
    console.log("  read_small_file...");
    try {
      [, ms] = await timeMs(() => fs.readTextFile(smallPath));
      recordSandbox(state, sandboxId, "read_small_file", ms);
      console.log(`  read_small_file  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  read_small_file ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "read_small_file");
    }

    // ── read large file ───────────────────────────────────────────────────────
    console.log("  read_large_file...");
    try {
      [, ms] = await timeMs(() => fs.readFile(largePath));
      recordSandbox(state, sandboxId, "read_large_file", ms);
      console.log(`  read_large_file  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  read_large_file ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "read_large_file");
    }

    // ── batch write relative (50 files, paths relative to workspace) ──────────
    console.log("  batch_write_relative...");
    try {
      const batchFilesRelative = Array.from({ length: 50 }, (_, i) => ({
        path: `benchmark_${index}/batch/file_${i}.txt`,
        content: `batch file ${i}\n`.repeat(20),
      }));
      [, ms] = await timeMs(() => fs.batchWrite(batchFilesRelative));
      recordSandbox(state, sandboxId, "batch_write_relative", ms);
      console.log(`  batch_write_relative  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  batch_write_relative ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "batch_write_relative");
    }

    // ── batch write absolute (50 files, absolute paths in /tmp) ───────────────
    console.log("  batch_write_absolute...");
    try {
      const batchFilesAbsolute = Array.from({ length: 50 }, (_, i) => ({
        path: `${benchDir}/batch/file_${i}.txt`,
        content: `batch file ${i}\n`.repeat(20),
      }));
      [, ms] = await timeMs(() => fs.batchWrite(batchFilesAbsolute));
      recordSandbox(state, sandboxId, "batch_write_absolute", ms);
      console.log(`  batch_write_absolute  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  batch_write_absolute ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "batch_write_absolute");
    }

    // ── readdir ───────────────────────────────────────────────────────────────
    console.log("  readdir...");
    try {
      [, ms] = await timeMs(() => fs.readdir(benchDir));
      recordSandbox(state, sandboxId, "readdir", ms);
      console.log(`  readdir  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  readdir ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "readdir");
    }

    // ── stat ──────────────────────────────────────────────────────────────────
    console.log("  stat...");
    try {
      [, ms] = await timeMs(() => fs.stat(smallPath));
      recordSandbox(state, sandboxId, "stat", ms);
      console.log(`  stat  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  stat ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "stat");
    }

    // ── copy file ─────────────────────────────────────────────────────────────
    const copyPath = `${benchDir}/small_copy.txt`;
    console.log("  copy_file...");
    try {
      [, ms] = await timeMs(() => fs.copy(smallPath, copyPath, false, true));
      recordSandbox(state, sandboxId, "copy_file", ms);
      console.log(`  copy_file  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  copy_file ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "copy_file");
    }

    // ── rename file ───────────────────────────────────────────────────────────
    const renamedPath = `${benchDir}/small_renamed.txt`;
    console.log("  rename_file...");
    try {
      [, ms] = await timeMs(() => fs.rename(copyPath, renamedPath, true));
      recordSandbox(state, sandboxId, "rename_file", ms);
      console.log(`  rename_file  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  rename_file ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "rename_file");
    }

    // ── remove file ───────────────────────────────────────────────────────────
    console.log("  remove_file...");
    try {
      [, ms] = await timeMs(() => fs.remove(renamedPath));
      recordSandbox(state, sandboxId, "remove_file", ms);
      console.log(`  remove_file  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  remove_file ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "remove_file");
    }

    // ── cmd: echo (baseline latency) ──────────────────────────────────────────
    console.log("  cmd_echo...");
    try {
      [, ms] = await timeMs(() => commands.run("echo hello"));
      recordSandbox(state, sandboxId, "cmd_echo", ms);
      console.log(`  cmd_echo  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      const detail = err instanceof CommandError ? `exit ${err.exitCode}: ${err.output.trim()}` : String(err);
      console.log(`  cmd_echo ✗  ${detail}`);
      recordSandboxError(state, sandboxId, "cmd_echo");
    }

    // ── cmd: CPU intensive — compute π with python3 (5000 decimal places) ──────
    console.log("  cmd_cpu_pi...");
    try {
      [, ms] = await timeMs(() =>
        commands.run(
          `python3 -c "from decimal import Decimal, getcontext; getcontext().prec=5000; print(sum(Decimal((-1)**k) / Decimal(2*k+1) for k in range(10000)) * 4)"`
        )
      );
      recordSandbox(state, sandboxId, "cmd_cpu_pi", ms);
      console.log(`  cmd_cpu_pi  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      const detail = err instanceof CommandError ? `exit ${err.exitCode}: ${err.output.trim()}` : String(err);
      console.log(`  cmd_cpu_pi ✗  ${detail}`);
      recordSandboxError(state, sandboxId, "cmd_cpu_pi");
    }

    // ── cmd: CPU intensive — sha256 of 256 MB of random data ──────────────────
    console.log("  cmd_cpu_hash...");
    try {
      [, ms] = await timeMs(() =>
        commands.run(
          `dd if=/dev/urandom bs=1M count=256 2>/dev/null | sha256sum`
        )
      );
      recordSandbox(state, sandboxId, "cmd_cpu_hash", ms);
      console.log(`  cmd_cpu_hash  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      const detail = err instanceof CommandError ? `exit ${err.exitCode}: ${err.output.trim()}` : String(err);
      console.log(`  cmd_cpu_hash ✗  ${detail}`);
      recordSandboxError(state, sandboxId, "cmd_cpu_hash");
    }

    // ── cmd: disk write — dd 256 MB to temp file ──────────────────────────────
    const ddFile = `${client.workspacePath}/dd_test_${index}.bin`;
    console.log("  cmd_disk_write...");
    try {
      [, ms] = await timeMs(() =>
        commands.run(
          `dd if=/dev/zero of=${ddFile} bs=1M count=256 conv=fdatasync 2>&1`
        )
      );
      recordSandbox(state, sandboxId, "cmd_disk_write", ms);
      console.log(`  cmd_disk_write  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      const detail = err instanceof CommandError ? `exit ${err.exitCode}: ${err.output.trim()}` : String(err);
      console.log(`  cmd_disk_write ✗  ${detail}`);
      recordSandboxError(state, sandboxId, "cmd_disk_write");
    }

    // ── cmd: disk read — dd 256 MB from temp file ─────────────────────────────
    console.log("  cmd_disk_read...");
    try {
      [, ms] = await timeMs(() =>
        commands.run(
          `dd if=${ddFile} of=/dev/null bs=1M 2>&1`
        )
      );
      recordSandbox(state, sandboxId, "cmd_disk_read", ms);
      console.log(`  cmd_disk_read  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      const detail = err instanceof CommandError ? `exit ${err.exitCode}: ${err.output.trim()}` : String(err);
      console.log(`  cmd_disk_read ✗  ${detail}`);
      recordSandboxError(state, sandboxId, "cmd_disk_read");
    }

    // ── cmd: filesystem traversal — find /usr -type f ─────────────────────────
    console.log("  cmd_find...");
    try {
      [, ms] = await timeMs(() =>
        commands.run(`find /usr -type f 2>/dev/null | wc -l`)
      );
      recordSandbox(state, sandboxId, "cmd_find", ms);
      console.log(`  cmd_find  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      const detail = err instanceof CommandError ? `exit ${err.exitCode}: ${err.output.trim()}` : String(err);
      console.log(`  cmd_find ✗  ${detail}`);
      recordSandboxError(state, sandboxId, "cmd_find");
    }

    // ── disconnect & cleanup ──────────────────────────────────────────────────
    console.log("  Disconnecting & shutting down (cleanup)...");
    try {
      await client.disconnect();
      client.dispose();
      client = undefined;
    } catch {
      /* best effort */
    }
    await tryCleanup(sdk, sandboxId);
    sandbox = undefined;
    console.log("  Done");
  } finally {
    try {
      await client?.disconnect();
      client?.dispose();
    } catch {
      /* best effort */
    }
    if (sandbox) {
      await tryCleanup(sdk, sandbox.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Vitest test entry point
// ---------------------------------------------------------------------------

const { templateId, iterations } = parseArgs();

// Allow up to 10 minutes per iteration (CPU/disk ops can be slow)
const TIMEOUT_MS = (iterations + 1) * 10 * 60 * 1000;

test("sandbox files-and-commands benchmark", { timeout: TIMEOUT_MS }, async () => {
  const sdk = initSDK();
  const state = createState();

  const baseUrl = process.env.CSB_BASE_URL ?? "https://api.codesandbox.io";
  console.log("Sandbox Files & Commands Benchmark");
  console.log(`  Template:   ${templateId}`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  API URL:    ${baseUrl}`);

  for (let i = 0; i < iterations; i++) {
    await runIteration(sdk, state, templateId, i);
  }

  printReport(ALL_OPS, state);
});
