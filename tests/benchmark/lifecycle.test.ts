/**
 * Sandbox Lifecycle Benchmark
 *
 * Measures timing for: create, hibernate, resume, shutdown, start (after shutdown)
 * Optionally measures time-to-port-ready for: create, resume, start (set CSB_PORT)
 * Runs N iterations and reports avg, median, p50, p90, p95, p99 per operation.
 *
 * Usage:
 *   CSB_API_KEY=<key> CSB_TEMPLATE_ID=<id> npm run benchmark
 *   CSB_API_KEY=<key> CSB_TEMPLATE_ID=<id> CSB_ITERATIONS=10 CSB_PORT=3000 npm run benchmark
 *
 * Environment Variables:
 *   CSB_API_KEY         CodeSandbox API key (required)
 *   CSB_TEMPLATE_ID     Template ID to fork from (required)
 *   CSB_BASE_URL        API base URL (default: https://api.codesandbox.io)
 *   CSB_ITERATIONS      Number of benchmark iterations (default: 5)
 *   CSB_PORT            Port to wait for after create/resume/start (optional)
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
  const port = process.env.CSB_PORT
    ? parseInt(process.env.CSB_PORT, 10)
    : undefined;

  if (!templateId) {
    throw new Error("CSB_TEMPLATE_ID environment variable is required.");
  }

  if (!process.env.CSB_API_KEY) {
    throw new Error("CSB_API_KEY environment variable is required.");
  }

  return { templateId, iterations, port };
}

// ---------------------------------------------------------------------------
// Operation names
// ---------------------------------------------------------------------------

const CORE_OPS = [
  "create",
  "hibernate",
  "resume",
  "shutdown",
  "start_after_shutdown",
] as const;

const PORT_OPS = [
  "create_to_port_ready",
  "resume_to_port_ready",
  "start_after_shutdown_to_port_ready",
] as const;

// ---------------------------------------------------------------------------
// Single benchmark iteration
// ---------------------------------------------------------------------------

async function runIteration(
  sdk: CodeSandbox,
  state: BenchmarkState,
  templateId: string,
  port: number | undefined,
  index: number
): Promise<void> {
  console.log(`\n── Iteration ${index + 1} ──────────────────────────────`);
  let sandbox: Sandbox | undefined;

  try {
    // ── create ────────────────────────────────────────────────────────────────
    console.log("  Creating...");
    let ms: number;
    let opStart: number;
    try {
      opStart = performance.now();
      [sandbox, ms] = await timeMs(() =>
        sdk.sandboxes.create({ id: templateId, tags: ["benchmark"] })
      );
      recordSandbox(state, sandbox.id, "create", ms);
      console.log(`  Created  ${(ms / 1000).toFixed(2)}s ✓  (id: ${sandbox.id})`);
    } catch (err) {
      console.log(`  Failed creating ✗  ${String(err)}`);
      return;
    }

    const sandboxId = sandbox.id;

    if (port) {
      const portMs = await measurePortReady(sandbox, port, opStart!);
      if (portMs !== null) recordSandbox(state, sandboxId, "create_to_port_ready", portMs);
      else recordSandboxError(state, sandboxId, "create_to_port_ready");
    }

    // // ── hibernate ─────────────────────────────────────────────────────────────
    // console.log("  Hibernating...");
    // try {
    //   [, ms] = await timeMs(() => sdk.sandboxes.hibernate(sandboxId));
    //   recordSandbox(state, sandboxId, "hibernate", ms);
    //   console.log(`  Hibernated  ${(ms / 1000).toFixed(2)}s ✓`);
    // } catch (err) {
    //   console.log(`  Failed hibernating ✗  ${String(err)}`);
    //   recordSandboxError(state, sandboxId, "hibernate");
    //   await tryCleanup(sdk, sandboxId);
    //   return;
    // }

    // // ── resume ────────────────────────────────────────────────────────────────
    // console.log("  Resuming...");
    // try {
    //   opStart = performance.now();
    //   [sandbox, ms] = await timeMs(() => sdk.sandboxes.resume(sandboxId));
    //   recordSandbox(state, sandboxId, "resume", ms);
    //   console.log(`  Resumed  ${(ms / 1000).toFixed(2)}s ✓`);
    // } catch (err) {
    //   console.log(`  Failed resuming ✗  ${String(err)}`);
    //   recordSandboxError(state, sandboxId, "resume");
    //   await tryCleanup(sdk, sandboxId);
    //   return;
    // }

    // if (port) {
    //   const portMs = await measurePortReady(sandbox, port, opStart!);
    //   if (portMs !== null) recordSandbox(state, sandboxId, "resume_to_port_ready", portMs);
    //   else recordSandboxError(state, sandboxId, "resume_to_port_ready");
    // }

    // ── shutdown ──────────────────────────────────────────────────────────────
    console.log("  Shutting down...");
    try {
      [, ms] = await timeMs(() => sdk.sandboxes.shutdown(sandboxId));
      recordSandbox(state, sandboxId, "shutdown", ms);
      console.log(`  Shut down  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  Failed shutting down ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "shutdown");
      await tryCleanup(sdk, sandboxId);
      return;
    }

    // ── start (after shutdown) ────────────────────────────────────────────────
    console.log("  Starting...");
    try {
      opStart = performance.now();
      [sandbox, ms] = await timeMs(() => sdk.sandboxes.resume(sandboxId));
      recordSandbox(state, sandboxId, "start_after_shutdown", ms);
      console.log(`  Started (after shutdown)  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  Failed starting (after shutdown) ✗  ${String(err)}`);
      recordSandboxError(state, sandboxId, "start_after_shutdown");
      await tryCleanup(sdk, sandboxId);
      return;
    }

    if (port) {
      const portMs = await measurePortReady(sandbox, port, opStart!);
      if (portMs !== null) recordSandbox(state, sandboxId, "start_after_shutdown_to_port_ready", portMs);
      else recordSandboxError(state, sandboxId, "start_after_shutdown_to_port_ready");
    }

    // ── final shutdown (unmeasured cleanup) ───────────────────────────────────
    console.log("  Shutting down (cleanup)...");
    await tryCleanup(sdk, sandboxId);
    sandbox = undefined;
    console.log("  Done");
  } finally {
    if (sandbox) {
      await tryCleanup(sdk, sandbox.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Vitest test entry point
// ---------------------------------------------------------------------------

const { templateId, iterations, port } = parseArgs();

// Allow up to 5 minutes per iteration plus overhead
const TIMEOUT_MS = (iterations + 1) * 5 * 60 * 1000;

test("sandbox lifecycle benchmark", { timeout: TIMEOUT_MS }, async () => {
  const sdk = initSDK();
  const state = createState();

  const baseUrl = process.env.CSB_BASE_URL ?? "https://api.codesandbox.io";
  console.log("Sandbox Lifecycle Benchmark");
  console.log(`  Template:   ${templateId}`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  API URL:    ${baseUrl}`);
  if (port) console.log(`  Port:       ${port}`);

  for (let i = 0; i < iterations; i++) {
    await runIteration(sdk, state, templateId, port, i);
  }

  const ops = port ? [...CORE_OPS, ...PORT_OPS] : [...CORE_OPS];
  printReport(ops, state);
});
