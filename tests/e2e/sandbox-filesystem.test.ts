import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CodeSandbox } from '../../src/index.js';
import { Sandbox } from '../../src/Sandbox.js';
import { SandboxClient } from '../../src/SandboxClient/index.js';
import { initializeSDK, TEST_TEMPLATE_ID } from './helpers.js';

describe('Sandbox Filesystem', () => {
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
  }, 60000); // 1 minute timeout for setup

  afterAll(async () => {
    // Cleanup: disconnect, shutdown and delete the sandbox
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
        // Try to force delete even if shutdown fails
        try {
          await sdk.sandboxes.delete(sandboxId);
        } catch (deleteError) {
          console.error('Failed to force delete sandbox:', sandboxId, deleteError);
        }
      }
    }
  });

  describe('File operations', () => {
    it('should write and read a file', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.writeTextFile('/test-file.txt', 'Hello, Sandbox!');
      const fileContent = await client.fs.readTextFile('/test-file.txt');

      expect(fileContent).toBe('Hello, Sandbox!');
    });

    it('should list files in directory', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const files = await client.fs.readdir('/');

      expect(files).toBeDefined();
      const testFile = files.find((f) => f.name === 'test-file.txt' && f.type === 'file');
      expect(testFile).toBeDefined();
    });

    it('should delete a file', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.remove('/test-file.txt');

      const filesAfterDeletion = await client.fs.readdir('/');
      const testFile = filesAfterDeletion.find((f) => f.name === 'test-file.txt');
      expect(testFile).toBeUndefined();
    });
  });

  describe('Directory operations', () => {
    it('should create a directory', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.mkdir('/test-dir');

      const dirs = await client.fs.readdir('/');
      const testDir = dirs.find((d) => d.name === 'test-dir' && d.type === 'directory');
      expect(testDir).toBeDefined();
    });

    it('should delete a directory', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.remove('/test-dir');

      const dirsAfterDeletion = await client.fs.readdir('/');
      const testDir = dirsAfterDeletion.find((d) => d.name === 'test-dir');
      expect(testDir).toBeUndefined();
    });
  });

  describe('Binary file operations', () => {
    it('should write and read binary files', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      const binaryData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" in bytes
      await client.fs.writeFile('/test-binary.bin', binaryData);

      const readData = await client.fs.readFile('/test-binary.bin');
      // Compare values instead of object types (readFile may return Buffer in Node.js)
      expect(Array.from(readData)).toEqual(Array.from(binaryData));

      // Cleanup
      await client.fs.remove('/test-binary.bin');
    });
  });

  describe('File stat operations', () => {
    it('should get file stats', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.writeTextFile('/stat-test.txt', 'test content');

      const stats = await client.fs.stat('/stat-test.txt');
      expect(stats).toBeDefined();
      expect(stats.type).toBe('file');
      expect(stats.size).toBeGreaterThan(0);

      // Cleanup
      await client.fs.remove('/stat-test.txt');
    });

    it('should get directory stats', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.mkdir('/stat-dir');

      const stats = await client.fs.stat('/stat-dir');
      expect(stats).toBeDefined();
      expect(stats.type).toBe('directory');

      // Cleanup
      await client.fs.remove('/stat-dir');
    });
  });

  describe('Copy operations', () => {
    it('should copy a file', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.writeTextFile('/copy-source.txt', 'copy test');
      await client.fs.copy('/copy-source.txt', '/copy-dest.txt');

      const content = await client.fs.readTextFile('/copy-dest.txt');
      expect(content).toBe('copy test');

      // Cleanup
      await client.fs.remove('/copy-source.txt');
      await client.fs.remove('/copy-dest.txt');
    });

    it('should copy a directory recursively', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.mkdir('/copy-dir');
      await client.fs.writeTextFile('/copy-dir/file.txt', 'nested file');
      await client.fs.copy('/copy-dir', '/copy-dir-dest', true);

      const content = await client.fs.readTextFile('/copy-dir-dest/file.txt');
      expect(content).toBe('nested file');

      // Cleanup
      await client.fs.remove('/copy-dir', true);
      await client.fs.remove('/copy-dir-dest', true);
    });
  });

  describe('Rename operations', () => {
    it('should rename a file', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.writeTextFile('/rename-old.txt', 'rename test');
      await client.fs.rename('/rename-old.txt', '/rename-new.txt');

      const content = await client.fs.readTextFile('/rename-new.txt');
      expect(content).toBe('rename test');

      const files = await client.fs.readdir('/');
      expect(files.find((f) => f.name === 'rename-old.txt')).toBeUndefined();
      expect(files.find((f) => f.name === 'rename-new.txt')).toBeDefined();

      // Cleanup
      await client.fs.remove('/rename-new.txt');
    });

    it('should rename a directory', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.mkdir('/rename-dir-old');
      await client.fs.writeTextFile('/rename-dir-old/file.txt', 'content');
      await client.fs.rename('/rename-dir-old', '/rename-dir-new');

      const content = await client.fs.readTextFile('/rename-dir-new/file.txt');
      expect(content).toBe('content');

      const dirs = await client.fs.readdir('/');
      expect(dirs.find((d) => d.name === 'rename-dir-old')).toBeUndefined();
      expect(dirs.find((d) => d.name === 'rename-dir-new')).toBeDefined();

      // Cleanup
      await client.fs.remove('/rename-dir-new', true);
    });
  });

  describe.skip('Batch write operations', () => {
    // Skip these tests - batchWrite uses zip/unzip which may not be available in all sandbox environments
    it('should write multiple files at once', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.mkdir('/batch-test');

      await client.fs.batchWrite([
        { path: '/batch-test/file1.txt', content: 'content 1' },
        { path: '/batch-test/file2.txt', content: 'content 2' },
        { path: '/batch-test/file3.txt', content: 'content 3' },
      ]);

      const content1 = await client.fs.readTextFile('/batch-test/file1.txt');
      const content2 = await client.fs.readTextFile('/batch-test/file2.txt');
      const content3 = await client.fs.readTextFile('/batch-test/file3.txt');

      expect(content1).toBe('content 1');
      expect(content2).toBe('content 2');
      expect(content3).toBe('content 3');

      // Cleanup
      await client.fs.remove('/batch-test', true);
    });

    it('should write nested directories in batch', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.batchWrite([
        { path: '/batch-nested/dir1/file.txt', content: 'nested 1' },
        { path: '/batch-nested/dir2/file.txt', content: 'nested 2' },
      ]);

      const content1 = await client.fs.readTextFile('/batch-nested/dir1/file.txt');
      const content2 = await client.fs.readTextFile('/batch-nested/dir2/file.txt');

      expect(content1).toBe('nested 1');
      expect(content2).toBe('nested 2');

      // Cleanup
      await client.fs.remove('/batch-nested', true);
    });
  });

  describe('Recursive operations', () => {
    it('should create nested directories', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.mkdir('/nested/deep/path', true);

      const stats = await client.fs.stat('/nested/deep/path');
      expect(stats.type).toBe('directory');

      // Cleanup
      await client.fs.remove('/nested', true);
    });

    it('should remove directory with contents recursively', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.mkdir('/recursive-remove');
      await client.fs.writeTextFile('/recursive-remove/file1.txt', 'content');
      await client.fs.mkdir('/recursive-remove/subdir');
      await client.fs.writeTextFile('/recursive-remove/subdir/file2.txt', 'content');

      await client.fs.remove('/recursive-remove', true);

      const files = await client.fs.readdir('/');
      expect(files.find((f) => f.name === 'recursive-remove')).toBeUndefined();
    });
  });

  describe('File watching', () => {
    it('should detect file system changes', async () => {
      if (!client || !sandbox) throw new Error('Client or sandbox not initialized');

      await client.fs.mkdir('/watch-dir');

      let changeDetected = false;
      const watcher = await client.fs.watch('/watch-dir', { recursive: true });
      const eventDisposable = watcher.onEvent((event) => {
        if (event.paths.some((p) => p.includes('watched-file.txt'))) {
          changeDetected = true;
        }
      });

      await client.fs.writeTextFile('/watch-dir/watched-file.txt', 'Watching this file');

      // Wait up to 10 seconds for the change to be detected
      const maxWaitTime = 10000;
      const pollInterval = 500;
      let waitedTime = 0;
      while (!changeDetected && waitedTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        waitedTime += pollInterval;
      }

      expect(changeDetected).toBe(true);

      eventDisposable.dispose();
      watcher.dispose();

      // Cleanup
      await client.fs.remove('/watch-dir/watched-file.txt');
      await client.fs.remove('/watch-dir');
    }, 30000);
  });
});
