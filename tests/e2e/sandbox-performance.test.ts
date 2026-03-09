import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SandboxClient } from "../../src/SandboxClient/index.js";
import { createTest } from "./helpers.js";

/**
 * Scenarios 3 & 5: File operations performance and agent-driven dev session
 *
 * Validates file read/write and command execution performance, plus git workflows.
 */
describe("Sandbox Performance", () => {
  const test = createTest();
  let client: SandboxClient | undefined;

  beforeAll(async () => {
    client = await test.sandbox.connect();
  }, 60000);

  afterAll(async () => {
    try {
      if (client) {
        await client.disconnect();
        client.dispose();
        client = undefined;
      }
    } catch (error) {
      console.error("Failed to dispose client:", error);
    }
  });

  describe("Sequential file write performance", () => {
    it("should write 20 files sequentially and read them back correctly", async () => {
      if (!client) throw new Error("Client not initialized");

      await client.fs.mkdir("/perf-test");

      const latencies: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await client.fs.writeTextFile(
          `/perf-test/file_${i}.txt`,
          `content for file ${i}`
        );
        latencies.push(Date.now() - start);
      }

      const maxLatency = Math.max(...latencies);
      const avgLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log(
        `File write latencies: avg=${avgLatency.toFixed(
          1
        )}ms, max=${maxLatency}ms`
      );

      // Verify file count
      const files = await client.fs.readdir("/perf-test");
      expect(files.filter((f) => f.type === "file").length).toBe(20);

      // Spot-check content
      const content5 = await client.fs.readTextFile("/perf-test/file_5.txt");
      expect(content5).toBe("content for file 5");

      const content19 = await client.fs.readTextFile("/perf-test/file_19.txt");
      expect(content19).toBe("content for file 19");

      // Cleanup
      await client.fs.remove("/perf-test", true);
    }, 60000);

    it("should write 30 files and report P50/P99 latency", async () => {
      if (!client) throw new Error("Client not initialized");

      await client.fs.mkdir("/sdk-perf-workspace/src", true);

      const writeLatencies: number[] = [];

      for (let i = 0; i < 30; i++) {
        const start = Date.now();
        await client.fs.writeTextFile(
          `/sdk-perf-workspace/src/component_${i}.ts`,
          `export const Component${i} = () => "component ${i}";`
        );
        writeLatencies.push(Date.now() - start);
      }

      writeLatencies.sort((a, b) => a - b);
      const p50 = writeLatencies[14];
      const p99 = writeLatencies[29];
      console.log(`Write P50: ${p50}ms, P99: ${p99}ms`);

      // Verify all files persisted
      const files = await client.fs.readdir("/sdk-perf-workspace/src");
      expect(files.filter((f) => f.type === "file").length).toBe(30);

      // Cleanup
      await client.fs.remove("/sdk-perf-workspace", true);
    }, 60000);
  });

  describe("Command burst performance", () => {
    it("should run 50 sequential commands and report P50/P99 latency", async () => {
      if (!client) throw new Error("Client not initialized");

      const latencies: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        const output = await client.commands.run(`echo "step ${i}"`);
        latencies.push(Date.now() - start);
        expect(output).toContain(`step ${i}`);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[24];
      const p99 = latencies[49];
      console.log(`Command P50: ${p50}ms, P99: ${p99}ms`);

      // P99 should be under 10 seconds (generous bound for E2E over network)
      expect(p99).toBeLessThan(10000);
    }, 180000);
  });

  describe("Package installation", () => {
    it("should install a package and verify it is usable", async () => {
      if (!client) throw new Error("Client not initialized");

      await client.commands.run(
        "mkdir -p /npm-test && cd /npm-test && npm init -y"
      );

      const installStart = Date.now();
      await client.commands.run("cd /npm-test && npm install express");
      const installDuration = Date.now() - installStart;
      console.log(`npm install express: ${installDuration}ms`);

      expect(installDuration).toBeLessThan(60000);

      // Verify the package is usable
      const verify = await client.commands.run(
        "node -e \"require('/npm-test/node_modules/express'); console.log('express loaded')\""
      );
      expect(verify).toContain("express loaded");

      // Cleanup
      await client.fs.remove("/npm-test", true);
    }, 120000);

    it("should complete a heavy package install within 120 seconds", async () => {
      if (!client) throw new Error("Client not initialized");

      await client.commands.run(
        "mkdir -p /heavy-install && cd /heavy-install && npm init -y"
      );

      const heavyStart = Date.now();
      await client.commands.run(
        "cd /heavy-install && npm install next react react-dom typescript @types/react"
      );
      const heavyDuration = Date.now() - heavyStart;
      console.log(`Heavy npm install: ${heavyDuration}ms`);

      expect(heavyDuration).toBeLessThan(120000);

      // Cleanup
      await client.fs.remove("/heavy-install", true);
    }, 180000);
  });

  describe("Git operations", () => {
    it("should perform git init, add, commit and log successfully", async () => {
      if (!client) throw new Error("Client not initialized");

      await client.fs.mkdir("/git-test/src", true);

      // Configure git
      await client.commands.run([
        "cd /git-test",
        "git init",
        "git config user.email 'test@test.com'",
        "git config user.name 'Test User'",
      ]);

      // Write some source files
      for (let i = 0; i < 5; i++) {
        await client.fs.writeTextFile(
          `/git-test/src/component_${i}.ts`,
          `export const Component${i} = () => "component ${i}";`
        );
      }

      // Stage and commit
      await client.commands.run("cd /git-test && git add .");
      await client.commands.run(
        "cd /git-test && git commit -m 'initial commit'"
      );

      // Verify commit is in log
      const log = await client.commands.run(
        "cd /git-test && git log --oneline"
      );
      expect(log).toContain("initial commit");

      // Verify all files were committed
      const trackedFiles = await client.commands.run(
        "cd /git-test && git ls-files | wc -l"
      );
      expect(parseInt(trackedFiles.trim())).toBe(5);

      // Cleanup
      await client.fs.remove("/git-test", true);
    }, 60000);
  });
});
