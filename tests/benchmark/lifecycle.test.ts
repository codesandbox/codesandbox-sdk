/**
 * Sandbox Operation Benchmark
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
import { SandboxClient } from "../../src/SandboxClient/index.js";

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
// SDK initialisation
// ---------------------------------------------------------------------------

function initSDK(): CodeSandbox {
  const baseUrl = process.env.CSB_BASE_URL ?? "https://api.codesandbox.io";
  return new CodeSandbox(process.env.CSB_API_KEY, { baseUrl });
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

async function timeMs<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  return [result, performance.now() - start];
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

interface Stats {
  samples: number;
  avg: number;
  min: number;
  max: number;
  median: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

function computeStats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const pct = (p: number) => {
    const rank = Math.ceil((p / 100) * n);
    return sorted[Math.min(rank, n) - 1];
  };

  const avg = values.reduce((sum, v) => sum + v, 0) / n;

  return {
    samples: n,
    avg,
    min: sorted[0],
    max: sorted[n - 1],
    median: pct(50),
    p50: pct(50),
    p90: pct(90),
    p95: pct(95),
    p99: pct(99),
  };
}

// ---------------------------------------------------------------------------
// Result storage
// ---------------------------------------------------------------------------

type OperationName =
  | "create"
  | "hibernate"
  | "resume"
  | "shutdown"
  | "start_after_shutdown"
  | "create_to_port_ready"
  | "resume_to_port_ready"
  | "start_after_shutdown_to_port_ready";

const timings: Record<OperationName, number[]> = {
  create: [],
  hibernate: [],
  resume: [],
  shutdown: [],
  start_after_shutdown: [],
  create_to_port_ready: [],
  resume_to_port_ready: [],
  start_after_shutdown_to_port_ready: [],
};

const errors: Record<OperationName, number> = {
  create: 0,
  hibernate: 0,
  resume: 0,
  shutdown: 0,
  start_after_shutdown: 0,
  create_to_port_ready: 0,
  resume_to_port_ready: 0,
  start_after_shutdown_to_port_ready: 0,
};

function record(op: OperationName, ms: number) {
  timings[op].push(ms);
}

function recordError(op: OperationName) {
  errors[op]++;
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

async function tryCleanup(sdk: CodeSandbox, sandboxId: string) {
  try {
    await sdk.sandboxes.shutdown(sandboxId);
  } catch {
    /* best effort */
  }
  try {
    await sdk.sandboxes.delete(sandboxId);
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Port readiness helper
// Measures time from `opStart` until the given port is ready on the sandbox.
// ---------------------------------------------------------------------------

async function measurePortReady(
  sandbox: Sandbox,
  port: number,
  opName: OperationName,
  opStart: number
): Promise<void> {
  let client: SandboxClient | undefined;
  try {
    client = await sandbox.connect();
    await client.ports.waitForPort(port, { timeoutMs: 120_000 });
    record(opName, performance.now() - opStart);
    console.log(
      `  Port ${port} ready  ${((performance.now() - opStart) / 1000).toFixed(2)}s ✓`
    );
  } catch (err) {
    console.log(`  Port ${port} not ready ✗  ${String(err)}`);
    recordError(opName);
  } finally {
    try {
      await client?.disconnect();
      client?.dispose();
    } catch {
      /* best effort */
    }
  }
}

// ---------------------------------------------------------------------------
// Single benchmark iteration
// ---------------------------------------------------------------------------

async function runIteration(
  sdk: CodeSandbox,
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
      record("create", ms);
      console.log(`  Created  ${(ms / 1000).toFixed(2)}s ✓  (id: ${sandbox.id})`);
    } catch (err) {
      console.log(`  Failed creating ✗  ${String(err)}`);
      recordError("create");
      return;
    }

    if (port) {
      await measurePortReady(sandbox, port, "create_to_port_ready", opStart!);
    }

    const sandboxId = sandbox.id;

    // ── hibernate ─────────────────────────────────────────────────────────────
    console.log("  Hibernating...");
    try {
      [, ms] = await timeMs(() => sdk.sandboxes.hibernate(sandboxId));
      record("hibernate", ms);
      console.log(`  Hibernated  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  Failed hibernating ✗  ${String(err)}`);
      recordError("hibernate");
      await tryCleanup(sdk, sandboxId);
      return;
    }

    // ── resume ────────────────────────────────────────────────────────────────
    console.log("  Resuming...");
    try {
      opStart = performance.now();
      [sandbox, ms] = await timeMs(() => sdk.sandboxes.resume(sandboxId));
      record("resume", ms);
      console.log(`  Resumed  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  Failed resuming ✗  ${String(err)}`);
      recordError("resume");
      await tryCleanup(sdk, sandboxId);
      return;
    }

    if (port) {
      await measurePortReady(sandbox, port, "resume_to_port_ready", opStart!);
    }

    // ── shutdown ──────────────────────────────────────────────────────────────
    console.log("  Shutting down...");
    try {
      [, ms] = await timeMs(() => sdk.sandboxes.shutdown(sandboxId));
      record("shutdown", ms);
      console.log(`  Shut down  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  Failed shutting down ✗  ${String(err)}`);
      recordError("shutdown");
      await tryCleanup(sdk, sandboxId);
      return;
    }

    // ── start (after shutdown) ────────────────────────────────────────────────
    console.log("  Starting...");
    try {
      opStart = performance.now();
      [sandbox, ms] = await timeMs(() => sdk.sandboxes.resume(sandboxId));
      record("start_after_shutdown", ms);
      console.log(`  Started (after shutdown)  ${(ms / 1000).toFixed(2)}s ✓`);
    } catch (err) {
      console.log(`  Failed starting (after shutdown) ✗  ${String(err)}`);
      recordError("start_after_shutdown");
      await tryCleanup(sdk, sandboxId);
      return;
    }

    if (port) {
      await measurePortReady(sandbox, port, "start_after_shutdown_to_port_ready", opStart!);
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
// Report
// ---------------------------------------------------------------------------

const CYAN = "\x1b[96m";
const RESET = "\x1b[0m";

function fmtField(key: string, ms: number, valueWidth: number): string {
  const raw = `${(ms / 1000).toFixed(2)}s`;
  const padded = raw.padEnd(valueWidth);
  return `${key}=${CYAN}${padded}${RESET}`;
}

function printReport(port: number | undefined) {
  const coreOps: OperationName[] = ["create", "hibernate", "resume", "shutdown", "start_after_shutdown"];
  const portOps: OperationName[] = ["create_to_port_ready", "resume_to_port_ready", "start_after_shutdown_to_port_ready"];
  const ops = port ? [...coreOps, ...portOps] : coreOps;

  const labelWidth = Math.max(...ops.map((o) => o.length)) + 2;
  const label = (op: OperationName) => op + ".".repeat(labelWidth - op.length);

  console.log("\n");
  console.log("BENCHMARK RESULTS");
  console.log("─────────────────\n");

  for (const op of ops) {
    const samples = timings[op];
    const errCount = errors[op];

    if (samples.length === 0) {
      if (errCount > 0) console.log(`${label(op)}: no data  errors=${errCount}`);
      continue;
    }

    const s = computeStats(samples);

    const row = [
      fmtField("avg",   s.avg,    8),
      fmtField("min",   s.min,    8),
      fmtField("med",   s.median, 8),
      fmtField("max",   s.max,    8),
      fmtField("p(90)", s.p90,    8),
      fmtField("p(95)", s.p95,    8),
      fmtField("p(99)", s.p99,    8),
      `n=${s.samples}`,
      ...(errCount > 0 ? [`errors=${errCount}`] : []),
    ].join("  ");

    console.log(`${label(op)}: ${row}`);
  }
}

// ---------------------------------------------------------------------------
// Vitest test entry point
// ---------------------------------------------------------------------------

const { templateId, iterations, port } = parseArgs();

// Allow up to 5 minutes per iteration plus overhead
const TIMEOUT_MS = (iterations + 1) * 5 * 60 * 1000;

test("sandbox benchmark", { timeout: TIMEOUT_MS }, async () => {
  const sdk = initSDK();

  const baseUrl = process.env.CSB_BASE_URL ?? "https://api.codesandbox.io";
  console.log("Sandbox Benchmark");
  console.log(`  Template:   ${templateId}`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  API URL:    ${baseUrl}`);
  if (port) console.log(`  Port:       ${port}`);

  for (let i = 0; i < iterations; i++) {
    await runIteration(sdk, templateId, port, i);
  }

  printReport(port);
});
