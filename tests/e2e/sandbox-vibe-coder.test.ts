import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SandboxClient } from "../../src/SandboxClient/index.js";
import { createTest } from "./helpers.js";

/**
 * Scenario 4: Full vibe coder workflow
 *
 * Simulates a realistic user journey: create sandbox, write code,
 * install deps, start dev server, verify preview URL, update code.
 */
describe("Sandbox Vibe Coder Workflow", () => {
  const test = createTest();
  let client: SandboxClient | undefined;

  beforeAll(async () => {
    client = await test.sandbox.connect();

    // Write application files
    await client.fs.mkdir("/app");
    await client.fs.writeTextFile(
      "/app/package.json",
      JSON.stringify(
        {
          name: "testing-party",
          scripts: { start: "node server.js" },
          dependencies: { express: "^4.18.0" },
        },
        null,
        2
      )
    );
    await client.fs.writeTextFile(
      "/app/server.js",
      [
        "const express = require('express');",
        "const app = express();",
        "app.get('/', (req, res) => res.send('<h1>Testing Party 2026</h1>'));",
        "app.get('/health', (req, res) => res.json({ status: 'ok' }));",
        "app.listen(3000, () => console.log('Server running on port 3000'));",
      ].join("\n")
    );

    // Write additional files simulating a typical AI coding session
    await client.fs.mkdir("/app/routes");
    await client.fs.mkdir("/app/middleware");
    await client.fs.mkdir("/app/utils");

    const additionalFiles = [
      {
        path: "/app/routes/index.js",
        content: "module.exports = require('./home');",
      },
      {
        path: "/app/routes/home.js",
        content:
          "const router = require('express').Router();\nrouter.get('/', (req, res) => res.send('home'));\nmodule.exports = router;",
      },
      {
        path: "/app/middleware/logger.js",
        content:
          "module.exports = (req, res, next) => { console.log(req.method, req.url); next(); };",
      },
      {
        path: "/app/utils/helpers.js",
        content: "exports.formatDate = (d) => d.toISOString();",
      },
      {
        path: "/app/config.js",
        content:
          "module.exports = { port: 3000, env: process.env.NODE_ENV || 'development' };",
      },
      { path: "/app/.env.example", content: "NODE_ENV=development\nPORT=3000" },
      {
        path: "/app/README.md",
        content: "# Testing Party 2026\n\nA simple Express server.",
      },
    ];

    for (const file of additionalFiles) {
      await client.fs.writeTextFile(file.path, file.content);
    }

    // Install dependencies — shared prerequisite for all tests below
    const installStart = Date.now();
    await client.commands.run("cd /app && npm install");
    console.log(`npm install: ${Date.now() - installStart}ms`);
  }, 180000);

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

  it("should have all application files written and dependencies installed", async () => {
    if (!client) throw new Error("Client not initialized");

    const appFiles = await client.fs.readdir("/app");
    expect(appFiles.find((f) => f.name === "package.json")).toBeDefined();
    expect(appFiles.find((f) => f.name === "server.js")).toBeDefined();

    const expressExists = await client.fs.stat("/app/node_modules/express");
    expect(expressExists).toBeDefined();
    expect(expressExists.type).toBe("directory");
  }, 30000);

  it("should start a dev server and respond to HTTP requests", async () => {
    if (!client) throw new Error("Client not initialized");

    const serverCmd = await client.commands.runBackground(
      "cd /app && node server.js"
    );

    try {
      await client.ports.waitForPort(3000, { timeoutMs: 20000 });

      const response = await client.commands.run(
        "curl -s http://localhost:3000"
      );
      expect(response).toContain("Testing Party 2026");

      const healthResponse = await client.commands.run(
        "curl -s http://localhost:3000/health"
      );
      expect(healthResponse).toContain("ok");

      const previewUrl = client.hosts.getUrl(3000);
      expect(previewUrl).toBeTruthy();
      expect(previewUrl).toContain("3000");
      expect(previewUrl).toContain(test.sandbox.id);
    } finally {
      await serverCmd.kill();
    }
  }, 60000);

  it("should reflect code changes after server restart", async () => {
    if (!client) throw new Error("Client not initialized");

    // Use port 3001 to avoid conflicts with port 3000 from the previous test
    await client.fs.writeTextFile(
      "/app/server.js",
      [
        "const express = require('express');",
        "const app = express();",
        "app.get('/', (req, res) => res.send('<h1>Updated: Testing Party 2026</h1>'));",
        "app.listen(3001, () => console.log('Server running on port 3001'));",
      ].join("\n")
    );

    const serverCmd = await client.commands.runBackground(
      "cd /app && node server.js"
    );

    try {
      await client.ports.waitForPort(3001, { timeoutMs: 20000 });

      const response = await client.commands.run(
        "curl -s http://localhost:3001"
      );
      expect(response).toContain("Updated: Testing Party 2026");
    } finally {
      await serverCmd.kill();
    }
  }, 60000);
});
