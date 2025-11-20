import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { Sandbox } from '../../src/Sandbox.js';
import { SandboxClient } from '../../src/SandboxClient/index.js';
import { initializeSDK, TEST_TEMPLATE_ID } from './helpers.js';

describe('Sandbox Setup', () => {
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

  describe('Setup operations', () => {
    it('should get setup status', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const status = client.setup.status;
      expect(status).toBeDefined();
      expect(['RUNNING', 'FINISHED', 'STOPPED', 'IDLE']).toContain(status);
    });

    it('should get setup steps', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const steps = client.setup.getSteps();
      expect(Array.isArray(steps)).toBe(true);
    });

    it('should get current step index', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const currentStepIndex = client.setup.currentStepIndex;
      expect(typeof currentStepIndex).toBe('number');
    });

    it('should wait until setup completes', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      // If setup is already finished, this should resolve immediately
      await client.setup.waitUntilComplete();

      const status = client.setup.status;
      expect(status).toBe('FINISHED');
    }, 60000);
  });

  describe('Setup steps', () => {
    it('should have step properties', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

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
