/**
 * Benchmark: Time to port ready
 *
 * Measures how long it takes from sandbox creation until a specific port is
 * ready on the sandbox. Run with different template IDs to compare pint vs pitcher.
 *
 * Usage:
 *   CSB_API_KEY=<key> CSB_TEMPLATE_ID=<id> CSB_PORT=3000 npx tsx scripts/benchmark-port-ready.ts
 *
 * Environment variables:
 *   CSB_API_KEY         - CodeSandbox API key (required)
 *   CSB_TEMPLATE_ID     - Template ID to fork sandboxes from (required)
 *   CSB_PORT            - Port number to wait for (default: 3000)
 *   CSB_RUNS            - Number of benchmark runs (default: 10)
 *   CSB_PORT_TIMEOUT_MS - Timeout waiting for port in ms (default: 120000)
 */

import { CodeSandbox } from '../src/index.js';

const API_KEY = process.env.CSB_API_KEY;
const TEMPLATE_ID = process.env.CSB_TEMPLATE_ID;
const PORT = parseInt(process.env.CSB_PORT ?? '3000', 10);
const RUNS = parseInt(process.env.CSB_RUNS ?? '10', 10);
const PORT_TIMEOUT_MS = parseInt(process.env.CSB_PORT_TIMEOUT_MS ?? '120000', 10);

if (!API_KEY) {
  console.error('Error: CSB_API_KEY environment variable is required');
  process.exit(1);
}
if (!TEMPLATE_ID) {
  console.error('Error: CSB_TEMPLATE_ID environment variable is required');
  process.exit(1);
}

async function measureRun(
  sdk: CodeSandbox,
  runIndex: number
): Promise<number> {
  const start = Date.now();
  let sandboxId: string | undefined;

  try {
    const sandbox = await sdk.sandboxes.create({ id: TEMPLATE_ID });
    sandboxId = sandbox.id;

    const client = await sandbox.connect();
    try {
      await client.ports.waitForPort(PORT, { timeoutMs: PORT_TIMEOUT_MS });
      return Date.now() - start;
    } finally {
      try {
        await client.disconnect();
        client.dispose();
      } catch {
        // best effort
      }
    }
  } finally {
    if (sandboxId) {
      try {
        await sdk.sandboxes.shutdown(sandboxId);
      } catch {
        // sandbox may already be stopped
      }
      try {
        await sdk.sandboxes.delete(sandboxId);
      } catch (e) {
        console.error(`  Warning: failed to delete sandbox ${sandboxId}:`, e);
      }
    }
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function fmt(ms: number): string {
  return `${ms.toFixed(0)}ms (${(ms / 1000).toFixed(2)}s)`;
}

async function main() {
  const sdk = new CodeSandbox(API_KEY!);
  const results: number[] = [];
  const failures: number[] = [];

  console.log('='.repeat(56));
  console.log('  CodeSandbox SDK Benchmark: Time to Port Ready');
  console.log('='.repeat(56));
  console.log(`  Template ID : ${TEMPLATE_ID}`);
  console.log(`  Port        : ${PORT}`);
  console.log(`  Runs        : ${RUNS}`);
  console.log(`  Timeout     : ${PORT_TIMEOUT_MS}ms`);
  console.log('='.repeat(56));

  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`\nRun ${i + 1}/${RUNS} ... `);
    try {
      const elapsed = await measureRun(sdk, i);
      results.push(elapsed);
      console.log(`${fmt(elapsed)}`);
    } catch (e) {
      failures.push(i + 1);
      console.log(`FAILED`);
      console.error(`  Error:`, e instanceof Error ? e.message : e);
    }
  }

  console.log('\n' + '='.repeat(56));
  console.log(`Results  (${results.length} succeeded, ${failures.length} failed)`);
  console.log('='.repeat(56));

  if (failures.length > 0) {
    console.log(`  Failed runs: ${failures.join(', ')}`);
  }

  if (results.length === 0) {
    console.error('  All runs failed — no statistics available.');
    process.exit(1);
  }

  results.forEach((ms, i) => {
    console.log(`  Run ${String(i + 1).padStart(2)}: ${fmt(ms)}`);
  });

  const sorted = [...results].sort((a, b) => a - b);
  const avg = results.reduce((a, b) => a + b, 0) / results.length;

  console.log('\nStatistics:');
  console.log(`  Min     : ${fmt(sorted[0])}`);
  console.log(`  Max     : ${fmt(sorted[sorted.length - 1])}`);
  console.log(`  Average : ${fmt(avg)}`);
  console.log(`  Median  : ${fmt(percentile(sorted, 50))}`);
  console.log(`  p90     : ${fmt(percentile(sorted, 90))}`);
  console.log(`  p95     : ${fmt(percentile(sorted, 95))}`);
  console.log(`  p99     : ${fmt(percentile(sorted, 99))}`);
  console.log('='.repeat(56));
}

main().catch((e) => {
  console.error('\nFatal error:', e);
  process.exit(1);
});
