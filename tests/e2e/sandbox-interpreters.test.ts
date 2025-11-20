import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { Sandbox } from '../../src/Sandbox.js';
import { SandboxClient } from '../../src/SandboxClient/index.js';
import { initializeSDK, TEST_TEMPLATE_ID } from './helpers.js';

describe('Sandbox Interpreters', () => {
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

  describe('JavaScript interpreter', () => {
    it('should execute simple JavaScript code', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const result = await client.interpreters.javascript('2 + 2');
      expect(result).toContain('4');
    });

    it('should execute JavaScript with variables', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const result = await client.interpreters.javascript(`
        const x = 10;
        const y = 20;
        console.log(x + y);
      `);
      expect(result).toContain('30');
    });

    it('should execute JavaScript with return statement', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const result = await client.interpreters.javascript(`
        const greeting = 'Hello from JavaScript';
        console.log(greeting);
      `);
      expect(result).toContain('Hello from JavaScript');
    });
  });

  describe('Python interpreter', () => {
    it('should execute simple Python code', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const result = await client.interpreters.python('2 + 2');
      expect(result).toContain('4');
    });

    it('should execute Python with variables', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const result = await client.interpreters.python(`
x = 10
y = 20
print(x + y)`);
      expect(result).toContain('30');
    });

    it('should execute Python with print statement', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const result = await client.interpreters.python(`
message = 'Hello from Python'
print(message)
      `);
      expect(result).toContain('Hello from Python');
    });
  });
});
