import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SandboxClient } from "../../src/SandboxClient/index.js";
import { createTest } from "./helpers.js";

describe("Sandbox Hosts", () => {
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

  describe("Host URL generation", () => {
    it("should generate URL for a port", async () => {
      if (!client) throw new Error("Client not initialized");

      const url = client.hosts.getUrl(3000);
      expect(url).toBeTruthy();
      expect(url).toContain("csb.app");
      expect(url).toContain("3000");
      expect(url).toContain(test.sandbox.id);
    });

    it("should generate URL with custom protocol", async () => {
      if (!client) throw new Error("Client not initialized");

      const url = client.hosts.getUrl(8080, "http");
      expect(url).toBeTruthy();
      expect(url.startsWith("http://")).toBe(true);
      expect(url).toContain("8080");
    });

    it("should generate URL with https by default", async () => {
      if (!client) throw new Error("Client not initialized");

      const url = client.hosts.getUrl(4000);
      expect(url.startsWith("https://")).toBe(true);
    });
  });

  describe("Host headers and cookies", () => {
    it("should get headers", async () => {
      if (!client) throw new Error("Client not initialized");

      const headers = client.hosts.getHeaders();
      expect(headers).toBeDefined();
      expect(typeof headers).toBe("object");
    });

    it("should get cookies", async () => {
      if (!client) throw new Error("Client not initialized");

      const cookies = client.hosts.getCookies();
      expect(cookies).toBeDefined();
      expect(typeof cookies).toBe("object");
    });
  });
});
