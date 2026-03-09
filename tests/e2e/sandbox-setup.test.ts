import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SandboxClient } from "../../src/SandboxClient/index.js";
import { createTest } from "./helpers.js";

describe("Sandbox Setup", () => {
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

  describe("Setup operations", () => {
    it("should get setup status", async () => {
      if (!client) throw new Error("Client not initialized");

      const status = client.setup.status;
      expect(status).toBeDefined();
      expect(["RUNNING", "FINISHED", "STOPPED", "IDLE"]).toContain(status);
    });

    it("should get setup steps", async () => {
      if (!client) throw new Error("Client not initialized");

      const steps = client.setup.getSteps();
      expect(Array.isArray(steps)).toBe(true);
    });

    it("should get current step index", async () => {
      if (!client) throw new Error("Client not initialized");

      const currentStepIndex = client.setup.currentStepIndex;
      expect(typeof currentStepIndex).toBe("number");
    });

    it("should wait until setup completes", async () => {
      if (!client) throw new Error("Client not initialized");

      // If setup is already finished, this should resolve immediately
      await client.setup.waitUntilComplete();

      const status = client.setup.status;
      expect(status).toBe("FINISHED");
    }, 60000);
  });

  describe("Setup steps", () => {
    it("should have step properties", async () => {
      if (!client) throw new Error("Client not initialized");

      const steps = client.setup.getSteps();

      if (steps.length > 0) {
        const firstStep = steps[0];
        expect(firstStep.name).toBeDefined();
        expect(firstStep.command).toBeDefined();
        expect(firstStep.status).toBeDefined();
      }
    });
  });
});
