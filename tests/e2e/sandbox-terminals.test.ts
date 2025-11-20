import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { Sandbox } from '../../src/Sandbox.js';
import { SandboxClient } from '../../src/SandboxClient/index.js';
import { initializeSDK, TEST_TEMPLATE_ID } from './helpers.js';

describe('Sandbox Terminals', () => {
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

  describe('Terminal creation', () => {
    it('should create a terminal', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminal = await client.terminals.create();
      expect(terminal).toBeDefined();
      expect(terminal.id).toBeTruthy();

      // Cleanup
      await terminal.kill();
    });

    it('should create terminal with custom dimensions', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminal = await client.terminals.create('bash', {
        dimensions: { cols: 120, rows: 40 },
      });
      expect(terminal).toBeDefined();
      expect(terminal.id).toBeTruthy();

      // Cleanup
      await terminal.kill();
    });
  });

  describe('Terminal listing', () => {
    it('should get all terminals', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminal1 = await client.terminals.create();
      const terminal2 = await client.terminals.create();

      const terminals = await client.terminals.getAll();
      expect(Array.isArray(terminals)).toBe(true);
      expect(terminals.length).toBeGreaterThanOrEqual(2);

      // Cleanup
      await terminal1.kill();
      await terminal2.kill();
    }, 15000);

    it('should get terminal by ID', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminal = await client.terminals.create();
      const retrieved = await client.terminals.get(terminal.id);

      expect(retrieved).toBeDefined();
      if (retrieved) {
        expect(retrieved.id).toBe(terminal.id);
      }

      // Cleanup
      await terminal.kill();
    });
  });

  describe('Terminal operations', () => {
    it('should write to terminal', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminal = await client.terminals.create();

      // Write a command
      await terminal.write('echo "test"\n');

      // Give it some time to execute
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Cleanup
      await terminal.kill();
    });

    it('should run command in terminal', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminal = await client.terminals.create();

      // Run a command (automatically adds newline)
      await terminal.run('echo "hello terminal"');

      // Give it some time to execute
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Cleanup
      await terminal.kill();
    });

    it('should receive output from terminal', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminal = await client.terminals.create();
      let receivedOutput = false;

      // Listen for output
      const disposable = terminal.onOutput((data) => {
        if (data.includes('unique_test_string')) {
          receivedOutput = true;
        }
      });

      // Write a command
      await terminal.write('echo "unique_test_string"\n');

      // Wait for output
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(receivedOutput).toBe(true);

      // Cleanup
      disposable.dispose();
      await terminal.kill();
    }, 10000);
  });

  describe('Terminal lifecycle', () => {
    it('should kill terminal', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminal = await client.terminals.create();
      expect(terminal).toBeDefined();
      expect(terminal.id).toBeTruthy();

      await terminal.kill();

      // Terminal has been killed
      expect(terminal.id).toBeTruthy();
    });

    it('should handle multiple terminals', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const terminals = await Promise.all([
        client.terminals.create(),
        client.terminals.create(),
        client.terminals.create(),
      ]);

      expect(terminals.length).toBe(3);
      expect(new Set(terminals.map((t) => t.id)).size).toBe(3); // All unique IDs

      // Cleanup all terminals
      await Promise.all(terminals.map((t) => t.kill()));
    });
  });
});
