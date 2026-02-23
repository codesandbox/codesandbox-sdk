import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SandboxClient } from "../../src/SandboxClient/index.js";
import { createTest } from "./helpers.js";

describe("Sandbox Commands", () => {
  const test = createTest();
  let client: SandboxClient | undefined;

  beforeAll(async () => {
    // Connect to sandbox
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

  describe("Command execution", () => {
    it("should run a simple command and get output", async () => {
      if (!client) throw new Error("Client not initialized");

      const output = await client.commands.run('echo "Hello from sandbox"');
      expect(output).toContain("Hello from sandbox");
    });

    it("should get output from pwd command", async () => {
      if (!client) throw new Error("Client not initialized");

      const output = await client.commands.run("pwd");
      expect(output).toBeTruthy();
      expect(output.trim()).toMatch(/^\//); // Should start with /
    });

    it("should run multiple commands sequentially", async () => {
      if (!client) throw new Error("Client not initialized");

      const output1 = await client.commands.run('echo "first"');
      const output2 = await client.commands.run('echo "second"');
      const output3 = await client.commands.run('echo "third"');

      expect(output1).toContain("first");
      expect(output2).toContain("second");
      expect(output3).toContain("third");
    });

    it("should run multiple commands with array syntax", async () => {
      if (!client) throw new Error("Client not initialized");

      // Array of commands should be joined with &&
      const output = await client.commands.run([
        'echo "first"',
        'echo "second"',
        'echo "third"',
      ]);

      expect(output).toContain("first");
      expect(output).toContain("second");
      expect(output).toContain("third");
    });
  });

  describe("Background commands", () => {
    it("should run command in background", async () => {
      if (!client) throw new Error("Client not initialized");

      const command = await client.commands.runBackground(
        'sleep 1 && echo "done"'
      );
      expect(command).toBeDefined();
      expect(command.status).toBe("RUNNING");

      // Wait for completion
      const output = await command.waitUntilComplete();
      expect(output).toContain("done");
    }, 10000);

    it("should run multiple commands in background with array syntax", async () => {
      if (!client) throw new Error("Client not initialized");

      // Array of commands should be joined with &&
      const command = await client.commands.runBackground([
        'echo "first"',
        'echo "second"',
        'echo "third"',
      ]);
      expect(command).toBeDefined();
      expect(command.status).toBe("RUNNING");

      // Wait for completion
      const output = await command.waitUntilComplete();
      expect(output).toContain("first");
      expect(output).toContain("second");
      expect(output).toContain("third");
    }, 10000);

    it("should be able to kill background command", async () => {
      if (!client) throw new Error("Client not initialized");

      const command = await client.commands.runBackground("sleep 30");
      expect(command).toBeDefined();

      await command.kill();

      // Command should be killed
      expect(command).toBeDefined();
    }, 10000);

    it("should stream output from a long-running command via onOutput", async () => {
      if (!client) throw new Error("Client not initialized");

      const command = await client.commands.runBackground(
        'for i in 1 2 3; do echo "line $i"; sleep 1; done'
      );
      expect(command.status).toBe("RUNNING");

      // Register listener before open() so we don't miss chunks that arrive
      // immediately after the first one unblocks the barrier
      const receivedChunks: string[] = [];
      command.onOutput((chunk) => {
        receivedChunks.push(chunk);
      });

      // open() subscribes to output and enables the onOutput event
      await command.open();

      const output = await command.waitUntilComplete();

      expect(output).toContain("line 1");
      expect(output).toContain("line 2");
      expect(output).toContain("line 3");
      // At least some chunks should have arrived incrementally via the event
      expect(receivedChunks.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe("Command listing", () => {
    it("should get all commands", async () => {
      if (!client) throw new Error("Client not initialized");

      const commands = await client.commands.getAll();
      expect(Array.isArray(commands)).toBe(true);
    });
  });

  describe("Working directory", () => {
    it("should run command in specified directory", async () => {
      if (!client) throw new Error("Client not initialized");

      // Create a test directory
      await client.fs.mkdir("/test-cwd");

      const output = await client.commands.run("pwd", { cwd: "/test-cwd" });
      expect(output).toContain("/test-cwd");

      // Cleanup
      await client.fs.remove("/test-cwd");
    });
  });

  describe("Environment variables", () => {
    it("should run command with custom environment variables", async () => {
      if (!client) throw new Error("Client not initialized");

      const output = await client.commands.run("echo $TEST_VAR", {
        env: { TEST_VAR: "custom_value" },
      });
      expect(output).toContain("custom_value");
    });
  });
});
