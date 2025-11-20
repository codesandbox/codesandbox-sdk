import { describe, it, expect, beforeAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { initializeSDK, TEST_TEMPLATE_ID } from './helpers.js';

describe('Sandbox Lifecycle', () => {
  let sdk: CodeSandbox;

  beforeAll(() => {
    sdk = initializeSDK();
  });

  it('should complete full lifecycle: create, hibernate, resume, restart, shutdown, delete', async () => {
    let sandboxId: string | undefined;

    try {
      // Create sandbox
      let sandbox = await sdk.sandboxes.create({
        id: TEST_TEMPLATE_ID,
      });
      expect(sandbox).toBeDefined();
      expect(sandbox.id).toBeTruthy();
      sandboxId = sandbox.id;

      // Hibernate sandbox
      await sdk.sandboxes.hibernate(sandboxId);

      // Resume sandbox
      sandbox = await sdk.sandboxes.resume(sandboxId);
      expect(sandbox).toBeDefined();
      expect(sandbox.id).toBe(sandboxId);

      // Restart sandbox
      await sdk.sandboxes.restart(sandboxId);

      // Shutdown sandbox
      await sdk.sandboxes.shutdown(sandboxId);

      // Delete sandbox
      await sdk.sandboxes.delete(sandboxId);
      sandboxId = undefined; // Mark as cleaned up
    } finally {
      // Ensure cleanup even on test failure
      if (sandboxId) {
        try {
          await sdk.sandboxes.shutdown(sandboxId);
          await sdk.sandboxes.delete(sandboxId);
        } catch (error) {
          console.error('Failed to cleanup sandbox:', sandboxId, error);
        }
      }
    }
  }, 120000); // 2 minutes timeout for the entire lifecycle
});
