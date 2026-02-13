import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SandboxClient } from "../../src/SandboxClient/index.js";
import { createTest } from "./helpers.js";

describe("Sandbox Tasks", () => {
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

  describe("Task listing", () => {
    it("should get all tasks", async () => {
      if (!client) throw new Error("Client not initialized");

      const tasks = await client.tasks.getAll();
      expect(Array.isArray(tasks)).toBe(true);
    });

    it("should get task by ID if tasks exist", async () => {
      if (!client) throw new Error("Client not initialized");

      const tasks = await client.tasks.getAll();

      if (tasks.length > 0) {
        const firstTask = tasks[0];
        const retrievedTask = await client.tasks.get(firstTask.id);

        expect(retrievedTask).toBeDefined();
        if (retrievedTask) {
          expect(retrievedTask.id).toBe(firstTask.id);
          expect(retrievedTask.name).toBe(firstTask.name);
        }
      }
    });
  });

  describe("Task properties", () => {
    it("should have task properties", async () => {
      if (!client) throw new Error("Client not initialized");

      const tasks = await client.tasks.getAll();

      if (tasks.length > 0) {
        const task = tasks[0];
        expect(task.id).toBeTruthy();
        expect(task.name).toBeTruthy();
        expect(task.command).toBeTruthy();
        expect(typeof task.runAtStart).toBe("boolean");
        expect(task.status).toBeDefined();
        expect(Array.isArray(task.ports)).toBe(true);
      }
    });
  });

  describe("Task operations", () => {
    // These tests are skipped as they require specific task configurations
    // and may interfere with running tasks
    it("should run a task", async () => {
      if (!client) throw new Error("Client not initialized");

      const tasks = await client.tasks.getAll();

      if (tasks.length > 0) {
        const task = tasks[0];
        await task.run();

        // Wait a bit for task to start
        await new Promise((resolve) => setTimeout(resolve, 2000));

        expect(task.status).toBeDefined();
      }
    });

    it("should stop a running task", async () => {
      if (!client) throw new Error("Client not initialized");

      const tasks = await client.tasks.getAll();

      if (tasks.length > 0) {
        const task = tasks[0];
        await task.run();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await task.stop();
      }
    });

    it("should restart a task", async () => {
      if (!client) throw new Error("Client not initialized");

      const tasks = await client.tasks.getAll();

      if (tasks.length > 0) {
        const task = tasks[0];
        await task.run();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await task.restart();
      }
    });
  });
});
