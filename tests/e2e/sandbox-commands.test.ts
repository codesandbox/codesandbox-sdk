import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { Sandbox } from '../../src/Sandbox.js';
import { SandboxClient } from '../../src/SandboxClient/index.js';
import { initializeSDK, TEST_TEMPLATE_ID } from './helpers.js';

describe('Sandbox Commands', () => {
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

  describe('Command execution', () => {
    it('should run a simple command and get output', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const output = await client.commands.run('echo "Hello from sandbox"');
      expect(output).toContain('Hello from sandbox');
    });

    it('should get output from pwd command', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const output = await client.commands.run('pwd');
      expect(output).toBeTruthy();
      expect(output.trim()).toMatch(/^\//); // Should start with /
    });

    it('should run multiple commands sequentially', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const output1 = await client.commands.run('echo "first"');
      const output2 = await client.commands.run('echo "second"');
      const output3 = await client.commands.run('echo "third"');

      expect(output1).toContain('first');
      expect(output2).toContain('second');
      expect(output3).toContain('third');
    });

    it('should run multiple commands with array syntax', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      // Array of commands should be joined with &&
      const output = await client.commands.run([
        'echo "first"',
        'echo "second"',
        'echo "third"',
      ]);

      expect(output).toContain('first');
      expect(output).toContain('second');
      expect(output).toContain('third');
    });
  });

  describe('Background commands', () => {
    it('should run command in background', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const command = await client.commands.runBackground('sleep 1 && echo "done"');
      expect(command).toBeDefined();
      expect(command.status).toBe('RUNNING');

      // Wait for completion
      const output = await command.waitUntilComplete();
      expect(output).toContain('done');
    }, 10000);

    it('should run multiple commands in background with array syntax', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      // Array of commands should be joined with &&
      const command = await client.commands.runBackground([
        'echo "first"',
        'echo "second"',
        'echo "third"',
      ]);
      expect(command).toBeDefined();
      expect(command.status).toBe('RUNNING');

      // Wait for completion
      const output = await command.waitUntilComplete();
      expect(output).toContain('first');
      expect(output).toContain('second');
      expect(output).toContain('third');
    }, 10000);

    it('should be able to kill background command', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const command = await client.commands.runBackground('sleep 30');
      expect(command).toBeDefined();

      await command.kill();

      // Command should be killed
      expect(command).toBeDefined();
    }, 10000);
  });

  describe('Command listing', () => {
    it('should get all commands', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const commands = await client.commands.getAll();
      expect(Array.isArray(commands)).toBe(true);
    });
  });

  describe('Working directory', () => {
    it('should run command in specified directory', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      // Create a test directory
      await client.fs.mkdir('/test-cwd');

      const output = await client.commands.run('pwd', { cwd: '/test-cwd' });
      expect(output).toContain('/test-cwd');

      // Cleanup
      await client.fs.remove('/test-cwd');
    });
  });

  describe('Environment variables', () => {
    it('should run command with custom environment variables', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const output = await client.commands.run('echo $TEST_VAR', {
        env: { TEST_VAR: 'custom_value' },
      });
      expect(output).toContain('custom_value');
    });
  });
});
