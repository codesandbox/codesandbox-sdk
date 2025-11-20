import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { Sandbox } from '../../src/Sandbox.js';
import { SandboxClient } from '../../src/SandboxClient/index.js';
import { initializeSDK, TEST_TEMPLATE_ID } from './helpers.js';

describe('Sandbox Hosts', () => {
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

  describe('Host URL generation', () => {
    it('should generate URL for a port', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const url = client.hosts.getUrl(3000);
      expect(url).toBeTruthy();
      expect(url).toContain('csb.app');
      expect(url).toContain('3000');
      expect(url).toContain(sandbox.id);
    });

    it('should generate URL with custom protocol', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const url = client.hosts.getUrl(8080, 'http');
      expect(url).toBeTruthy();
      expect(url.startsWith('http://')).toBe(true);
      expect(url).toContain('8080');
    });

    it('should generate URL with https by default', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const url = client.hosts.getUrl(4000);
      expect(url.startsWith('https://')).toBe(true);
    });
  });

  describe('Host headers and cookies', () => {
    it('should get headers', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const headers = client.hosts.getHeaders();
      expect(headers).toBeDefined();
      expect(typeof headers).toBe('object');
    });

    it('should get cookies', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const cookies = client.hosts.getCookies();
      expect(cookies).toBeDefined();
      expect(typeof cookies).toBe('object');
    });
  });
});
