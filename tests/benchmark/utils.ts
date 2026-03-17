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

export interface SandboxRecord {
  id: string;
  timings: Record<string, number>;
  errors: string[];
}

export interface BenchmarkState {
  sandboxes: SandboxRecord[];
}

export function createState(): BenchmarkState {
  return { sandboxes: [] };
}

function getOrCreate(state: BenchmarkState, id: string): SandboxRecord {
  let entry = state.sandboxes.find((s) => s.id === id);
  if (!entry) {
    entry = { id, timings: {}, errors: [] };
    state.sandboxes.push(entry);
  }
  return entry;
}

export function recordSandbox(
  state: BenchmarkState,
  id: string,
  op: string,
  ms: number
): void {
  getOrCreate(state, id).timings[op] = ms;
}

export function recordSandboxError(
  state: BenchmarkState,
  id: string,
  op: string
): void {
  getOrCreate(state, id).errors.push(op);
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
// Returns elapsed ms, or null on failure.
// ---------------------------------------------------------------------------

export async function measurePortReady(
  sandbox: Sandbox,
  port: number,
  opStart: number
): Promise<number | null> {
  let client: SandboxClient | undefined;
  try {
    client = await sandbox.connect();
    await client.ports.waitForPort(port, { timeoutMs: 120_000 });
    const ms = performance.now() - opStart;
    console.log(`  Port ${port} ready  ${(ms / 1000).toFixed(2)}s ✓`);
    return ms;
  } catch (err) {
    console.log(`  Port ${port} not ready ✗  ${String(err)}`);
    return null;
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
    const samples = state.sandboxes
      .map((s) => s.timings[op])
      .filter((v): v is number => v !== undefined);
    const errCount = state.sandboxes.filter((s) => s.errors.includes(op)).length;

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

  if (state.sandboxes.length > 0) {
    console.log("\nPER-SANDBOX TIMINGS");
    console.log("───────────────────\n");

    const headers = ["SANDBOX ID", ...ops.map((op) => op.toUpperCase())];
    const rows = state.sandboxes.map(({ id, timings, errors }) => [
      id,
      ...ops.map((op) => {
        if (timings[op] !== undefined) return `${(timings[op] / 1000).toFixed(2)}s`;
        if (errors.includes(op)) return "ERROR";
        return "-";
      }),
    ]);

    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => r[i].length))
    );

    const sep = "    ";
    console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join(sep));
    for (const row of rows) {
      const line = row.map((val, i) => {
        const plain = val.padEnd(colWidths[i]);
        if (val === "ERROR") return `\x1b[91m${plain}\x1b[0m`;
        if (val === "-")     return `\x1b[2m${plain}\x1b[0m`;
        return plain;
      });
      console.log(line.join(sep));
    }
  }
}
