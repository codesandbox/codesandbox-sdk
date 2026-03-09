import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SandboxClient } from "../../src/SandboxClient/index.js";
import { createTest, TEST_TEMPLATE_ID } from "./helpers.js";

/**
 * Scenario 7: Error handling and recovery
 *
 * Tests how the SDK handles invalid inputs, bad states, and interrupted operations.
 */
describe("Sandbox Error Handling", () => {
  const test = createTest();

  describe("Invalid inputs", () => {
    it("should throw a clear error when creating from a nonexistent template", async () => {
      const error = await test.sdk.sandboxes
        .create({ id: "nonexistent-template-xyz-abc-123" })
        .catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBeTruthy();
      console.log("Invalid template error:", error.message);
    }, 30000);
  });

  describe("Double delete", () => {
    it("should throw on deleting an already-deleted sandbox", async () => {
      let sandboxId: string | undefined;

      try {
        const sandbox = await test.sdk.sandboxes.create({
          id: TEST_TEMPLATE_ID,
          title: "test-double-delete",
        });
        sandboxId = sandbox.id;

        // First delete should succeed
        await test.sdk.sandboxes.shutdown(sandboxId);
        await test.sdk.sandboxes.delete(sandboxId);
        sandboxId = undefined;

        // Second delete should throw
        const error = await test.sdk.sandboxes
          .delete(sandbox.id)
          .catch((e) => e);

        expect(error).toBeInstanceOf(Error);
        console.log("Double delete error:", error.message);
      } finally {
        if (sandboxId) {
          try {
            await test.sdk.sandboxes.shutdown(sandboxId);
            await test.sdk.sandboxes.delete(sandboxId);
          } catch {}
        }
      }
    }, 60000);
  });

  describe("Resume behavior", () => {
    it("should handle resume on an already-running sandbox without crashing", async () => {
      // Resume on a running sandbox should either succeed (idempotent) or throw a clear error
      const result = await test.sdk.sandboxes
        .resume(test.sandbox.id)
        .catch((e) => e);

      if (result instanceof Error) {
        console.log("Resume-on-running error:", result.message);
        expect(result.message).toBeTruthy();
      } else {
        // Idempotent behavior: returned a sandbox object
        expect(result.id).toBe(test.sandbox.id);
        console.log("Resume-on-running returned sandbox, bootupType:", result.bootupType);
      }
    }, 30000);
  });

  describe("Concurrent commands", () => {
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
      } catch {}
    });

    it("should complete all concurrent commands without deadlock", async () => {
      if (!client) throw new Error("Client not initialized");

      const results = await Promise.all([
        client.commands.run("echo cmd-1"),
        client.commands.run("echo cmd-2"),
        client.commands.run("echo cmd-3"),
        client.commands.run("echo cmd-4"),
        client.commands.run("echo cmd-5"),
      ]);

      expect(results.length).toBe(5);
      results.forEach((r, i) => {
        expect(r).toContain(`cmd-${i + 1}`);
      });
    }, 30000);

    it("should remain usable while a long-running background command is active", async () => {
      if (!client) throw new Error("Client not initialized");

      // Start a long-running command but don't await it
      const longCmd = client.commands.runBackground("sleep 60");

      try {
        // We should still be able to run other commands
        const other = await client.commands.run("echo still responsive");
        expect(other).toContain("still responsive");

        const another = await client.commands.run("echo second command");
        expect(another).toContain("second command");
      } finally {
        // Kill the long-running command
        const cmd = await longCmd;
        await cmd.kill();
      }
    }, 30000);
  });
});
