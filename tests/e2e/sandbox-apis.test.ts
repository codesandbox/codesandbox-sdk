import { describe, it, expect } from "vitest";
import { retryUntil, createTest } from "./helpers.js";

describe("Sandbox APIs", () => {
  const test = createTest();

  it("should find sandbox in list", async () => {
    expect(test.sandbox.id).toBeDefined();

    const sandboxes = await test.sdk.sandboxes.list({ limit: 10 });
    expect(sandboxes).toBeDefined();
    expect(sandboxes.sandboxes).toBeDefined();

    const found = sandboxes.sandboxes.find((s) => s.id === test.sandbox.id);
    expect(found).toBeDefined();
  });

  it("should find sandbox in running list by filter", async () => {
    expect(test.sandbox.id).toBeDefined();

    const foundInList = await retryUntil(60000, 3000, async () => {
      const runningSandboxesByFilter = await test.sdk.sandboxes.list({
        status: "running",
      });
      return runningSandboxesByFilter.sandboxes.find(
        (s) => s.id === test.sandbox.id
      );
    });

    expect(foundInList).toBeDefined();
  }, 70000);

  it("should find sandbox in running list by API", async () => {
    expect(test.sandbox.id).toBeDefined();

    const foundByAPI = await retryUntil(60000, 3000, async () => {
      const runningSandboxByAPI = await test.sdk.sandboxes.listRunning();
      return runningSandboxByAPI.vms.find((s) => s.id === test.sandbox.id);
    });

    expect(foundByAPI).toBeDefined();
  }, 70000);

  it("should get sandbox by ID", async () => {
    expect(test.sandbox.id).toBeDefined();

    const fetchedSandbox = await test.sdk.sandboxes.get(test.sandbox.id);
    expect(fetchedSandbox).toBeDefined();
    expect(fetchedSandbox.id).toBe(test.sandbox.id);
  });
});
