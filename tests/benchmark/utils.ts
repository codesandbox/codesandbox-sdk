import { CodeSandbox, Sandbox } from "../../src/index.js";
import { SandboxClient } from "../../src/SandboxClient/index.js";

// ---------------------------------------------------------------------------
// SDK initialisation
// ---------------------------------------------------------------------------

export function initSDK(): CodeSandbox {
  const baseUrl = process.env.CSB_BASE_URL ?? "https://api.codesandbox.io";
  return new CodeSandbox(process.env.CSB_API_KEY, { baseUrl });
}

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

export async function timeMs<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  return [result, performance.now() - start];
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface Stats {
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

export function computeStats(values: number[]): Stats {
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
// Benchmark state
// ---------------------------------------------------------------------------

export interface BenchmarkState {
  timings: Record<string, number[]>;
  errors: Record<string, number>;
}

export function createState(ops: readonly string[]): BenchmarkState {
  return {
    timings: Object.fromEntries(ops.map((op) => [op, []])),
    errors: Object.fromEntries(ops.map((op) => [op, 0])),
  };
}

export function record(state: BenchmarkState, op: string, ms: number): void {
  state.timings[op].push(ms);
}

export function recordError(state: BenchmarkState, op: string): void {
  state.errors[op]++;
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

export async function tryCleanup(sdk: CodeSandbox, sandboxId: string): Promise<void> {
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

export async function measurePortReady(
  sandbox: Sandbox,
  port: number,
  opName: string,
  opStart: number,
  state: BenchmarkState
): Promise<void> {
  let client: SandboxClient | undefined;
  try {
    client = await sandbox.connect();
    await client.ports.waitForPort(port, { timeoutMs: 120_000 });
    record(state, opName, performance.now() - opStart);
    console.log(
      `  Port ${port} ready  ${((performance.now() - opStart) / 1000).toFixed(2)}s ✓`
    );
  } catch (err) {
    console.log(`  Port ${port} not ready ✗  ${String(err)}`);
    recordError(state, opName);
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
// Report
// ---------------------------------------------------------------------------

const CYAN = "\x1b[96m";
const RESET = "\x1b[0m";

export function fmtField(key: string, ms: number, valueWidth: number): string {
  const raw = `${(ms / 1000).toFixed(2)}s`;
  const padded = raw.padEnd(valueWidth);
  return `${key}=${CYAN}${padded}${RESET}`;
}

export function printReport(ops: readonly string[], state: BenchmarkState): void {
  const labelWidth = Math.max(...ops.map((o) => o.length)) + 2;
  const label = (op: string) => op + ".".repeat(labelWidth - op.length);

  console.log("\n");
  console.log("BENCHMARK RESULTS");
  console.log("─────────────────\n");

  for (const op of ops) {
    const samples = state.timings[op];
    const errCount = state.errors[op];

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
