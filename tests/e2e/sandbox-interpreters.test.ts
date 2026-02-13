import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SandboxClient } from "../../src/SandboxClient/index.js";
import { createTest } from "./helpers.js";

describe("Sandbox Interpreters", () => {
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

  describe("JavaScript interpreter", () => {
    it("should execute simple JavaScript code", async () => {
      if (!client) throw new Error("Client not initialized");

      const result = await client.interpreters.javascript("2 + 2");
      expect(result).toContain("4");
    });

    it("should execute JavaScript with variables", async () => {
      if (!client) throw new Error("Client not initialized");

      const result = await client.interpreters.javascript(`
        const x = 10;
        const y = 20;
        console.log(x + y);
      `);
      expect(result).toContain("30");
    });

    it("should execute JavaScript with return statement", async () => {
      if (!client) throw new Error("Client not initialized");

      const result = await client.interpreters.javascript(`
        const greeting = 'Hello from JavaScript';
        console.log(greeting);
      `);
      expect(result).toContain("Hello from JavaScript");
    });
  });

  describe("Python interpreter", () => {
    it("should execute simple Python code", async () => {
      if (!client) throw new Error("Client not initialized");

      const result = await client.interpreters.python("2 + 2");
      expect(result).toContain("4");
    });

    it("should execute Python with variables", async () => {
      if (!client) throw new Error("Client not initialized");

      const result = await client.interpreters.python(`
x = 10
y = 20
print(x + y)`);
      expect(result).toContain("30");
    });

    it("should execute Python with print statement", async () => {
      if (!client) throw new Error("Client not initialized");

      const result = await client.interpreters.python(`
message = 'Hello from Python'
print(message)
      `);
      expect(result).toContain("Hello from Python");
    });
  });
});
