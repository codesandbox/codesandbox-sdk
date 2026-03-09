import { describe, it, expect } from "vitest";
import { createTest } from "./helpers.js";

/**
 * Scenario 8: State consistency edge cases
 *
 * Tests rapid hibernate/resume cycles, concurrent operations, and
 * state integrity when interrupting long-running operations.
 */
describe("Sandbox State Consistency", () => {
  const test = createTest();

  it("should handle 5 rapid hibernate/resume cycles with state intact", async () => {
    // Write anchor file before cycling
    const setupClient = await test.sandbox.connect();
    try {
      await setupClient.fs.writeTextFile(
        "/anchor.txt",
        "do not lose me"
      );
    } finally {
      await setupClient.disconnect();
      setupClient.dispose();
    }

    let currentSandbox = test.sandbox;

    for (let i = 0; i < 5; i++) {
      await test.sdk.sandboxes.hibernate(currentSandbox.id);
      currentSandbox = await test.sdk.sandboxes.resume(currentSandbox.id);

      const cycleClient = await currentSandbox.connect();
      try {
        const content = await cycleClient.fs.readTextFile("/anchor.txt");
        expect(content).toBe("do not lose me");
        console.log(`Cycle ${i + 1}: OK`);
      } finally {
        await cycleClient.disconnect();
        cycleClient.dispose();
      }
    }
  }, 300000);

  it("should complete multiple concurrent commands without error", async () => {
    const client = await test.sandbox.connect();

    try {
      const results = await Promise.all([
        client.commands.run("echo cmd-1"),
        client.commands.run("echo cmd-2"),
        client.commands.run("echo cmd-3"),
        client.commands.run("echo cmd-4"),
        client.commands.run("echo cmd-5"),
      ]);

      expect(results.length).toBe(5);
      expect(results[0]).toContain("cmd-1");
      expect(results[1]).toContain("cmd-2");
      expect(results[2]).toContain("cmd-3");
      expect(results[3]).toContain("cmd-4");
      expect(results[4]).toContain("cmd-5");

      console.log("All concurrent commands completed:", results.length);
    } finally {
      await client.disconnect();
      client.dispose();
    }
  }, 30000);

  it("should recover gracefully after hibernating during a running npm install", async () => {
    const client = await test.sandbox.connect();

    try {
      await client.commands.run(
        "mkdir -p /mid-install-test && cd /mid-install-test && npm init -y"
      );

      // Start npm install and do NOT await (fire and forget)
      const installPromise = client.commands
        .run(
          "cd /mid-install-test && npm install next react react-dom typescript"
        )
        .catch(() => {
          // Expected: install may be interrupted by hibernate
        });

      // Hibernate after a short delay (mid-install)
      await new Promise((r) => setTimeout(r, 5000));
    } finally {
      await client.disconnect();
      client.dispose();
    }

    await test.sdk.sandboxes.hibernate(test.sandbox.id);
    const resumed = await test.sdk.sandboxes.resume(test.sandbox.id);

    const afterClient = await resumed.connect();
    try {
      // State should be recoverable: either install completed or can be re-run
      const checkResult = await afterClient.commands.run(
        "ls /mid-install-test/node_modules 2>/dev/null | head -5 || echo 'no node_modules'"
      );
      console.log("After resume mid-install state:", checkResult.trim());

      // The sandbox should be responsive
      const echo = await afterClient.commands.run("echo still alive");
      expect(echo).toContain("still alive");

      // Cleanup
      await afterClient.fs.remove("/mid-install-test", true);
    } finally {
      await afterClient.disconnect();
      afterClient.dispose();
    }
  }, 120000);
});
