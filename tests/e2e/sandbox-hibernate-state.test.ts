import { describe, it, expect } from "vitest";
import { createTest } from "./helpers.js";

/**
 * Scenario 2: Hibernate and resume with state verification
 *
 * Verifies that sandbox state (files) persists through hibernate/resume cycles.
 */
describe("Sandbox Hibernate State", () => {
  const test = createTest();

  it("should preserve file content through a hibernate/resume cycle", async () => {
    const client = await test.sandbox.connect();

    try {
      await client.fs.writeTextFile(
        "/hibernate-state-test.txt",
        "testing party 2026"
      );
      const beforeContent = await client.fs.readTextFile(
        "/hibernate-state-test.txt"
      );
      expect(beforeContent).toBe("testing party 2026");
    } finally {
      await client.disconnect();
      client.dispose();
    }

    await test.sdk.sandboxes.hibernate(test.sandbox.id);

    const resumeStart = Date.now();
    const resumed = await test.sdk.sandboxes.resume(test.sandbox.id);
    console.log(`Resume time: ${Date.now() - resumeStart}ms`);

    const afterClient = await resumed.connect();
    try {
      const afterContent = await afterClient.fs.readTextFile(
        "/hibernate-state-test.txt"
      );
      expect(afterContent).toBe("testing party 2026");

      // Verify via command as well
      const cmdOutput = await afterClient.commands.run(
        "cat /hibernate-state-test.txt"
      );
      expect(cmdOutput).toContain("testing party 2026");
    } finally {
      await afterClient.disconnect();
      afterClient.dispose();
    }
  }, 120000);

  it("should preserve file content through 3 consecutive hibernate/resume cycles", async () => {
    const client = await test.sandbox.connect();
    try {
      await client.fs.writeTextFile("/anchor.txt", "testing party 2026");
    } finally {
      await client.disconnect();
      client.dispose();
    }

    let currentSandbox = test.sandbox;

    for (let i = 0; i < 3; i++) {
      await test.sdk.sandboxes.hibernate(currentSandbox.id);

      const cycleStart = Date.now();
      currentSandbox = await test.sdk.sandboxes.resume(currentSandbox.id);
      console.log(`Cycle ${i + 1} resume: ${Date.now() - cycleStart}ms`);

      const cycleClient = await currentSandbox.connect();
      try {
        const content = await cycleClient.fs.readTextFile("/anchor.txt");
        expect(content).toBe("testing party 2026");
      } finally {
        await cycleClient.disconnect();
        cycleClient.dispose();
      }
    }
  }, 300000);

  it("should report bootupType as RESUME after hibernation", async () => {
    const client = await test.sandbox.connect();
    await client.disconnect();
    client.dispose();

    await test.sdk.sandboxes.hibernate(test.sandbox.id);
    const resumed = await test.sdk.sandboxes.resume(test.sandbox.id);

    expect(resumed.bootupType).toBe("RESUME");

    const afterClient = await resumed.connect();
    await afterClient.disconnect();
    afterClient.dispose();
  }, 120000);
});
