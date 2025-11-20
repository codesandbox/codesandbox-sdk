import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { Sandbox } from '../../src/Sandbox.js';
import { SandboxClient } from '../../src/SandboxClient/index.js';
import { initializeSDK, TEST_TEMPLATE_ID } from './helpers.js';

describe('Sandbox Ports', () => {
  let sdk: CodeSandbox;
  let sandbox: Sandbox | undefined;
  let client: SandboxClient | undefined;

  beforeAll(async () => {
    sdk = initializeSDK();

    // Create a sandbox for testing
    sandbox = await sdk.sandboxes.create({
      id: TEST_TEMPLATE_ID,
    });

    // Connect to sandbox
    client = await sandbox.connect();
  }, 60000);

  afterAll(async () => {
    const sandboxId = sandbox?.id;

    try {
      if (client) {
        await client.disconnect();
        client.dispose();
        client = undefined;
      }
    } catch (error) {
      console.error('Failed to dispose client:', error);
    }

    if (sandboxId) {
      try {
        await sdk.sandboxes.shutdown(sandboxId);
        await sdk.sandboxes.delete(sandboxId);
      } catch (error) {
        console.error('Failed to cleanup test sandbox:', sandboxId, error);
        try {
          await sdk.sandboxes.delete(sandboxId);
        } catch (deleteError) {
          console.error('Failed to force delete sandbox:', sandboxId, deleteError);
        }
      }
    }
  });

  describe('Port listing', () => {
    it('should get all open ports', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const ports = await client.ports.getAll();
      expect(Array.isArray(ports)).toBe(true);
    });
  });

  describe('Port operations with server', () => {
    // Skipped - these tests have shell lifecycle management issues
    it('should detect when a port opens', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      // Start a simple HTTP server in the background
      const serverCommand = await client.commands.runBackground(`node -e 'require("http").createServer((req, res) => res.end("hello")).listen(8888)'`);

      try {
        // Wait for port to open (with timeout)
        const portInfo = await client.ports.waitForPort(8888, { timeoutMs: 20000 });
        expect(portInfo).toBeDefined();
        expect(portInfo.port).toBe(8888);
        expect(portInfo.host).toBeTruthy();
      } finally {
        // Cleanup: kill the server
        await serverCommand.kill();
      }
    }, 40000);

    it('should get port information', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      // Start a server
      const serverCommand = await client.commands.runBackground(`node -e 'require("http").createServer((req, res) => res.end("test")).listen(9999)'`);

      try {
        // Wait for port to open
        await client.ports.waitForPort(9999, { timeoutMs: 20000 });

        // Get port info
        const portInfo = await client.ports.get(9999);
        expect(portInfo).toBeDefined();
        if (portInfo) {
          expect(portInfo.port).toBe(9999);
          expect(portInfo.host).toBeTruthy();
        }
      } finally {
        // Cleanup
        await serverCommand.kill();
      }
    }, 40000);
  });

  describe('Port events', () => {
    // Skipped - these tests have shell lifecycle management issues
    it('should listen to port opened events', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      let portOpened = false;
      let openedPort = 0;

      // Listen for port open events
      const disposable = client.ports.onDidPortOpen((port) => {
        if (port.port === 7777) {
          portOpened = true;
          openedPort = port.port;
        }
      });

      // Start a server
      const serverCommand = await client.commands.runBackground(`node -e 'require("http").createServer((req, res) => res.end("test")).listen(7777)'`);

      try {
        // Wait for the port to be detected
        await client.ports.waitForPort(7777, { timeoutMs: 20000 });

        // Give some time for the event to fire
        await new Promise((resolve) => setTimeout(resolve, 2000));

        expect(portOpened).toBe(true);
        expect(openedPort).toBe(7777);
      } finally {
        disposable.dispose();
        await serverCommand.kill();
      }
    }, 40000);
  });
});
