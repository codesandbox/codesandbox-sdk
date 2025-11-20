import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { initializeSDK, TEST_TEMPLATE_ID, retryUntil } from './helpers.js';

describe('Sandbox APIs', () => {
  let sdk: CodeSandbox;
  let sandboxId: string | undefined;

  beforeAll(async () => {
    sdk = initializeSDK();

    // Create a sandbox for testing
    const sandbox = await sdk.sandboxes.create({
      id: TEST_TEMPLATE_ID,
    });
    sandboxId = sandbox.id;
  });

  afterAll(async () => {
    // Cleanup: shutdown and delete the sandbox
    if (sandboxId) {
      try {
        await sdk.sandboxes.shutdown(sandboxId);
        await sdk.sandboxes.delete(sandboxId);
      } catch (error) {
        console.error('Failed to cleanup test sandbox:', sandboxId, error);
        // Try to force delete even if shutdown fails
        try {
          await sdk.sandboxes.delete(sandboxId);
        } catch (deleteError) {
          console.error('Failed to force delete sandbox:', sandboxId, deleteError);
        }
      }
    }
  });

  it('should find sandbox in list', async () => {
    expect(sandboxId).toBeDefined();
    if (!sandboxId) throw new Error('Sandbox not created');

    const sandboxes = await sdk.sandboxes.list();
    expect(sandboxes).toBeDefined();
    expect(sandboxes.sandboxes).toBeDefined();

    const found = sandboxes.sandboxes.find((s) => s.id === sandboxId);
    expect(found).toBeDefined();
  });

  it('should find sandbox in running list by filter', async () => {
    expect(sandboxId).toBeDefined();
    if (!sandboxId) throw new Error('Sandbox not created');

    const foundInList = await retryUntil(60000, 3000, async () => {
      const runningSandboxesByFilter = await sdk.sandboxes.list({
        status: 'running',
      });
      return runningSandboxesByFilter.sandboxes.find((s) => s.id === sandboxId);
    });

    expect(foundInList).toBeDefined();
  }, 70000);

  it('should find sandbox in running list by API', async () => {
    expect(sandboxId).toBeDefined();
    if (!sandboxId) throw new Error('Sandbox not created');

    const foundByAPI = await retryUntil(60000, 3000, async () => {
      const runningSandboxByAPI = await sdk.sandboxes.listRunning();
      return runningSandboxByAPI.vms.find((s) => s.id === sandboxId);
    });

    expect(foundByAPI).toBeDefined();
  }, 70000);

  it('should get sandbox by ID', async () => {
    expect(sandboxId).toBeDefined();
    if (!sandboxId) throw new Error('Sandbox not created');

    const fetchedSandbox = await sdk.sandboxes.get(sandboxId);
    expect(fetchedSandbox).toBeDefined();
    expect(fetchedSandbox.id).toBe(sandboxId);
  });
});
