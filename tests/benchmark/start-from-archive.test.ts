/**
 * Sandbox Start-from-Archive Benchmark
 *
 * Measures how long it takes to resume a sandbox from archived state and
 * optionally wait for a port to be ready.
 *
 * The sandbox must already be in an archived state before running. Each
 * iteration resumes the sandbox, records timings, then re-archives it for
 * the next iteration.
 *
 * Usage:
 *   CSB_API_KEY=<key> CSB_SANDBOX_ID=<id> CSB_PORT=3000 npm run benchmark -- --project start-from-archive
 *
 * Environment Variables:
 *   CSB_API_KEY         CodeSandbox API key (required)
 *   CSB_SANDBOX_ID      ID of the archived sandbox (required)
 *   CSB_PORT            Port to wait for after resume (optional)
 *   CSB_BASE_URL        API base URL (default: https://api.codesandbox.io)
 *   CSB_ITERATIONS      Number of benchmark iterations (default: 5)
 */

import { test } from "vitest";
import { CodeSandbox, Sandbox } from "../../src/index.js";
import {
  BenchmarkState,
  createState,
  initSDK,
  measurePortReady,
  printReport,
  recordSandbox,
  recordSandboxError,
  timeMs,
} from "./utils.js";

// ---------------------------------------------------------------------------
// CLI / env argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const sandboxId = process.env.CSB_SANDBOX_ID;
  const iterations = process.env.CSB_ITERATIONS
    ? parseInt(process.env.CSB_ITERATIONS, 10)
    : 5;
  const port = process.env.CSB_PORT
    ? parseInt(process.env.CSB_PORT, 10)
    : undefined;

  if (!sandboxId) {
    throw new Error("CSB_SANDBOX_ID environment variable is required.");
  }

  if (!process.env.CSB_API_KEY) {
    throw new Error("CSB_API_KEY environment variable is required.");
  }

  return { sandboxId, iterations, port };
}

// ---------------------------------------------------------------------------
// Operation names
// ---------------------------------------------------------------------------

const CORE_OPS = ["start_from_archive"] as const;
const PORT_OPS = ["start_from_archive_to_port_ready"] as const;

// ---------------------------------------------------------------------------
// Single benchmark iteration
// ---------------------------------------------------------------------------

async function runIteration(
  sdk: CodeSandbox,
  state: BenchmarkState,
  sandboxId: string,
  port: number | undefined,
  index: number
): Promise<void> {
  console.log(`\n── Iteration ${index + 1} ──────────────────────────────`);

  // ── resume from archive ───────────────────────────────────────────────────
  console.log("  Resuming from archive...");
  let sandbox: Sandbox;
  let opStart: number;
  let ms: number;
  try {
    opStart = performance.now();
    [sandbox, ms] = await timeMs(() => sdk.sandboxes.resume(sandboxId));
    recordSandbox(state, sandboxId, "start_from_archive", ms);
    console.log(`  Started from archive  ${(ms / 1000).toFixed(2)}s ✓`);
  } catch (err) {
    console.log(`  Failed to start from archive ✗  ${String(err)}`);
    recordSandboxError(state, sandboxId, "start_from_archive");
    return;
  }

  // ── port readiness ────────────────────────────────────────────────────────
  if (port) {
    const portMs = await measurePortReady(sandbox, port, opStart);
    if (portMs !== null) recordSandbox(state, sandboxId, "start_from_archive_to_port_ready", portMs);
    else recordSandboxError(state, sandboxId, "start_from_archive_to_port_ready");
  }

  // ── re-archive for next iteration ─────────────────────────────────────────
  if (index < iterations - 1) {
    console.log("  Archiving...");
    try {
      await sdk.sandboxes.hibernate(sandboxId);
      console.log("  Archived ✓");
    } catch (err) {
      console.log(`  Failed to archive ✗  ${String(err)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Vitest test entry point
// ---------------------------------------------------------------------------

const { sandboxId, iterations, port } = parseArgs();

// Allow up to 5 minutes per iteration plus overhead
const TIMEOUT_MS = (iterations + 1) * 5 * 60 * 1000;

test("sandbox start-from-archive benchmark", { timeout: TIMEOUT_MS }, async () => {
  const sdk = initSDK();
  const state = createState();

  const baseUrl = process.env.CSB_BASE_URL ?? "https://api.codesandbox.io";
  console.log("Sandbox Start-from-Archive Benchmark");
  console.log(`  Sandbox ID: ${sandboxId}`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  API URL:    ${baseUrl}`);
  if (port) console.log(`  Port:       ${port}`);

  for (let i = 0; i < iterations; i++) {
    await runIteration(sdk, state, sandboxId, port, i);
  }

  const ops = port ? [...CORE_OPS, ...PORT_OPS] : [...CORE_OPS];
  printReport(ops, state);
});
