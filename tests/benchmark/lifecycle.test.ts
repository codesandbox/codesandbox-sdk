/**
 * Sandbox Operation Benchmark
 *
 * Measures timing for: create, hibernate, resume, fork, shutdown
 * Runs N iterations and reports avg, median, p50, p90, p95, p99 per operation.
 *
 * Usage:
 *   CSB_API_KEY=<key> CSB_TEMPLATE_ID=<id> npm run benchmark
 *   CSB_API_KEY=<key> CSB_TEMPLATE_ID=<id> CSB_ITERATIONS=10 npm run benchmark
 *
 * Environment Variables:
 *   CSB_API_KEY         CodeSandbox API key (required)
 *   CSB_TEMPLATE_ID     Template ID to fork from (required)
 *   CSB_BASE_URL        API base URL (default: https://api.codesandbox.io)
 *   CSB_ITERATIONS      Number of benchmark iterations (default: 5)
 */

import { test } from "vitest";
import { CodeSandbox, Sandbox } from "../../src/index.js";

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

type OperationName = "create" | "hibernate" | "resume" | "fork" | "shutdown";

const timings: Record<OperationName, number[]> = {
  create: [],
  hibernate: [],
  resume: [],
  fork: [],
  shutdown: [],
};

const errors: Record<OperationName, number> = {
  create: 0,
  hibernate: 0,
  resume: 0,
  fork: 0,
  shutdown: 0,
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
// Single benchmark iteration
// ---------------------------------------------------------------------------

async function runIteration(
  sdk: CodeSandbox,
  templateId: string,
  index: number
): Promise<void> {
  console.log(`\n── Iteration ${index + 1} ──────────────────────────────`);
  let sandbox: Sandbox | undefined;
  let forkedSandbox: Sandbox | undefined;

  try {
    // ── create ────────────────────────────────────────────────────────────────
    process.stdout.write("  create     ");
    let ms: number;
    try {
      [sandbox, ms] = await timeMs(() =>
        sdk.sandboxes.create({ id: templateId, tags: ["benchmark"] })
      );
      record("create", ms);
      console.log(`${ms.toFixed(0)} ms  ✓  (id: ${sandbox.id})`);
    } catch (err) {
      console.log(`FAILED  ✗  ${String(err)}`);
      recordError("create");
      return; // Cannot continue without a sandbox
    }

    const sandboxId = sandbox.id;

    // ── hibernate ─────────────────────────────────────────────────────────────
    process.stdout.write("  hibernate  ");
    try {
      [, ms] = await timeMs(() => sdk.sandboxes.hibernate(sandboxId));
      record("hibernate", ms);
      console.log(`${ms.toFixed(0)} ms  ✓`);
    } catch (err) {
      console.log(`FAILED  ✗  ${String(err)}`);
      recordError("hibernate");
      await tryCleanup(sdk, sandboxId);
      return;
    }

    // ── resume ────────────────────────────────────────────────────────────────
    process.stdout.write("  resume     ");
    try {
      [sandbox, ms] = await timeMs(() => sdk.sandboxes.resume(sandboxId));
      record("resume", ms);
      console.log(`${ms.toFixed(0)} ms  ✓`);
    } catch (err) {
      console.log(`FAILED  ✗  ${String(err)}`);
      recordError("resume");
      await tryCleanup(sdk, sandboxId);
      return;
    }

    // ── fork ──────────────────────────────────────────────────────────────────
    process.stdout.write("  fork       ");
    try {
      [forkedSandbox, ms] = await timeMs(() =>
        sdk.sandboxes.create({ id: sandboxId, tags: ["benchmark-fork"] })
      );
      record("fork", ms);
      console.log(`${ms.toFixed(0)} ms  ✓  (fork id: ${forkedSandbox.id})`);
    } catch (err) {
      console.log(`FAILED  ✗  ${String(err)}`);
      recordError("fork");
    }

    if (forkedSandbox) {
      await tryCleanup(sdk, forkedSandbox.id);
    }

    // ── shutdown ──────────────────────────────────────────────────────────────
    process.stdout.write("  shutdown   ");
    try {
      [, ms] = await timeMs(() => sdk.sandboxes.shutdown(sandboxId));
      record("shutdown", ms);
      console.log(`${ms.toFixed(0)} ms  ✓`);
    } catch (err) {
      console.log(`FAILED  ✗  ${String(err)}`);
      recordError("shutdown");
    }
  } finally {
    if (sandbox) {
      await tryCleanup(sdk, sandbox.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const METRIC_NAMES: Record<OperationName, string> = {
  create:    "sandbox_create_duration",
  hibernate: "sandbox_hibernate_duration",
  resume:    "sandbox_resume_duration",
  fork:      "sandbox_fork_duration",
  shutdown:  "sandbox_shutdown_duration",
};

const LABEL_WIDTH = Math.max(...Object.values(METRIC_NAMES).map((n) => n.length)) + 2;

function metricLabel(op: OperationName): string {
  const name = METRIC_NAMES[op];
  const dots = ".".repeat(LABEL_WIDTH - name.length);
  return `${name}${dots}`;
}

const CYAN = "\x1b[96m";
const RESET = "\x1b[0m";

function fmtField(key: string, ms: number, valueWidth: number): string {
  const raw = `${(ms / 1000).toFixed(2)}s`;
  const padded = raw.padEnd(valueWidth);
  return `${key}=${CYAN}${padded}${RESET}`;
}

function printReport() {
  const ops: OperationName[] = [
    "create",
    "hibernate",
    "resume",
    "fork",
    "shutdown",
  ];

  console.log("\n");
  console.log("benchmark results");

  for (const op of ops) {
    const label = metricLabel(op);
    const samples = timings[op];
    const errCount = errors[op];

    if (samples.length === 0) {
      console.log(`${label}: no data  errors=${errCount}`);
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

    console.log(`${label}: ${row}`);
  }
}

// ---------------------------------------------------------------------------
// Vitest test entry point
// ---------------------------------------------------------------------------

const { templateId, iterations } = parseArgs();

// Allow up to 5 minutes per iteration plus overhead
const TIMEOUT_MS = (iterations + 1) * 5 * 60 * 1000;

test("sandbox benchmark", { timeout: TIMEOUT_MS }, async () => {
  const sdk = initSDK();

  const baseUrl = process.env.CSB_BASE_URL ?? "https://api.codesandbox.io";
  console.log("Sandbox Benchmark");
  console.log(`  Template:   ${templateId}`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  API URL:    ${baseUrl}`);

  for (let i = 0; i < iterations; i++) {
    await runIteration(sdk, templateId, i);
  }

  printReport();
});
