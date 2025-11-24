import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PintFsClient } from '../src/PintClient/fs';
import { Client } from '../src/api-clients/pint/client';
import * as pintApi from '../src/api-clients/pint';

// Mock the API functions
vi.mock('../src/api-clients/pint', () => ({
  createFile: vi.fn(),
  readFile: vi.fn(),
  performFileAction: vi.fn(),
  listDirectory: vi.fn(),
  createDirectory: vi.fn(),
  deleteDirectory: vi.fn(),
  getFileStat: vi.fn(),
}));

// Helper to create proper mock response
const createMockResponse = (data: any, error?: any) => ({
  data,
  error,
  request: {} as any,
  response: {} as any,
});

describe('PintFsClient', () => {
  let client: PintFsClient;
  let mockApiClient: Client;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient = {} as Client;
    client = new PintFsClient(mockApiClient);
  });

  describe('readFile', () => {
    it('should successfully read a file and convert to Uint8Array', async () => {
      const mockResponse = createMockResponse({ content: 'Hello World' });
      vi.mocked(pintApi.readFile).mockResolvedValue(mockResponse);

      const result = await client.readFile('/test/file.txt');

      expect(result).toEqual({
        type: 'ok',
        result: {
          content: new TextEncoder().encode('Hello World'),
        },
      });
      expect(pintApi.readFile).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { path: '/test/file.txt' },
      });
    });

    it('should handle API error response', async () => {
      const mockResponse = createMockResponse(undefined, { message: 'File not found' });
      vi.mocked(pintApi.readFile).mockResolvedValue(mockResponse);

      const result = await client.readFile('/test/missing.txt');

      expect(result).toEqual({
        type: 'error',
        error: 'File not found',
        errno: null,
      });
    });

    it('should handle thrown exceptions', async () => {
      vi.mocked(pintApi.readFile).mockRejectedValue(new Error('Network error'));

      const result = await client.readFile('/test/file.txt');

      expect(result).toEqual({
        type: 'error',
        error: 'Network error',
        errno: null,
      });
    });

    it('should handle unknown error types', async () => {
      vi.mocked(pintApi.readFile).mockRejectedValue('String error');

      const result = await client.readFile('/test/file.txt');

      expect(result).toEqual({
        type: 'error',
        error: 'Unknown error',
        errno: null,
      });
    });
  });

  describe('readdir', () => {
    it('should successfully read directory entries', async () => {
      const mockResponse = createMockResponse({
        files: [
          { name: 'file1.txt', isDir: false },
          { name: 'subdir', isDir: true },
        ],
      });
      vi.mocked(pintApi.listDirectory).mockResolvedValue(mockResponse);

      const result = await client.readdir('/test');

      expect(result).toEqual({
        type: 'ok',
        result: {
          entries: [
            { name: 'file1.txt', type: 0, isSymlink: false },
            { name: 'subdir', type: 1, isSymlink: false },
          ],
        },
      });
      expect(pintApi.listDirectory).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { path: '/test' },
      });
    });

    it('should handle API error response', async () => {
      const mockResponse = createMockResponse(undefined, { message: 'Permission denied' });
      vi.mocked(pintApi.listDirectory).mockResolvedValue(mockResponse);

      const result = await client.readdir('/protected');

      expect(result).toEqual({
        type: 'error',
        error: 'Permission denied',
        errno: null,
      });
    });
  });

  describe('writeFile', () => {
    it('should successfully write file content', async () => {
      const mockResponse = createMockResponse({});
      vi.mocked(pintApi.createFile).mockResolvedValue(mockResponse);

      const content = new TextEncoder().encode('Hello World');
      const result = await client.writeFile('/test/new.txt', content);

      expect(result).toEqual({
        type: 'ok',
        result: {},
      });
      expect(pintApi.createFile).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { path: '/test/new.txt' },
        body: { content: 'Hello World' },
      });
    });

    it('should handle API error response', async () => {
      const mockResponse = createMockResponse(undefined, { message: 'Disk full' });
      vi.mocked(pintApi.createFile).mockResolvedValue(mockResponse);

      const content = new TextEncoder().encode('data');
      const result = await client.writeFile('/test/file.txt', content);

      expect(result).toEqual({
        type: 'error',
        error: 'Disk full',
        errno: null,
      });
    });
  });

  describe('remove', () => {
    it('should successfully remove directory/file', async () => {
      const mockResponse = createMockResponse({});
      vi.mocked(pintApi.deleteDirectory).mockResolvedValue(mockResponse);

      const result = await client.remove('/test/path');

      expect(result).toEqual({
        type: 'ok',
        result: {},
      });
      expect(pintApi.deleteDirectory).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { path: '/test/path' },
      });
    });

    it('should handle API error response', async () => {
      const mockResponse = createMockResponse(undefined, { message: 'Path not found' });
      vi.mocked(pintApi.deleteDirectory).mockResolvedValue(mockResponse);

      const result = await client.remove('/test/missing');

      expect(result).toEqual({
        type: 'error',
        error: 'Path not found',
        errno: null,
      });
    });
  });

  describe('mkdir', () => {
    it('should successfully create directory', async () => {
      const mockResponse = createMockResponse({});
      vi.mocked(pintApi.createDirectory).mockResolvedValue(mockResponse);

      const result = await client.mkdir('/test/newdir');

      expect(result).toEqual({
        type: 'ok',
        result: {},
      });
      expect(pintApi.createDirectory).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { path: '/test/newdir' },
      });
    });

    it('should handle API error response', async () => {
      const mockResponse = createMockResponse(undefined, { message: 'Directory exists' });
      vi.mocked(pintApi.createDirectory).mockResolvedValue(mockResponse);

      const result = await client.mkdir('/test/existing');

      expect(result).toEqual({
        type: 'error',
        error: 'Directory exists',
        errno: null,
      });
    });
  });

  describe('stat', () => {
    it('should successfully get file stats', async () => {
      const mockResponse = createMockResponse({
        isDir: false,
        size: 1024,
        modTime: '2023-01-01T12:00:00Z',
      });
      vi.mocked(pintApi.getFileStat).mockResolvedValue(mockResponse);

      const result = await client.stat('/test/file.txt');

      const expectedTime = new Date('2023-01-01T12:00:00Z').getTime();
      expect(result).toEqual({
        type: 'ok',
        result: {
          type: 0, // file
          isSymlink: false,
          size: 1024,
          mtime: expectedTime,
          ctime: expectedTime,
          atime: expectedTime,
        },
      });
      expect(pintApi.getFileStat).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { path: '/test/file.txt' },
      });
    });

    it('should handle directory stats', async () => {
      const mockResponse = createMockResponse({
        isDir: true,
        size: 0,
        modTime: '2023-01-01T12:00:00Z',
      });
      vi.mocked(pintApi.getFileStat).mockResolvedValue(mockResponse);

      const result = await client.stat('/test/dir');

      expect(result.type).toBe('ok');
      if (result.type === 'ok') {
        expect(result.result.type).toBe(1); // directory
      }
    });

    it('should handle API error response', async () => {
      const mockResponse = createMockResponse(undefined, { message: 'File not found' });
      vi.mocked(pintApi.getFileStat).mockResolvedValue(mockResponse);

      const result = await client.stat('/test/missing.txt');

      expect(result).toEqual({
        type: 'error',
        error: 'File not found',
        errno: null,
      });
    });
  });

  describe('copy', () => {
    it('should successfully copy file', async () => {
      const mockResponse = createMockResponse({});
      vi.mocked(pintApi.performFileAction).mockResolvedValue(mockResponse);

      const result = await client.copy('/src/file.txt', '/dest/file.txt');

      expect(result).toEqual({
        type: 'ok',
        result: {},
      });
      expect(pintApi.performFileAction).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { path: '/src/file.txt' },
        body: {
          action: 'copy',
          destination: '/dest/file.txt',
        },
      });
    });

    it('should handle API error response', async () => {
      const mockResponse = createMockResponse(undefined, { message: 'Source not found' });
      vi.mocked(pintApi.performFileAction).mockResolvedValue(mockResponse);

      const result = await client.copy('/src/missing.txt', '/dest/file.txt');

      expect(result).toEqual({
        type: 'error',
        error: 'Source not found',
        errno: null,
      });
    });
  });

  describe('rename', () => {
    it('should successfully rename/move file', async () => {
      const mockResponse = createMockResponse({});
      vi.mocked(pintApi.performFileAction).mockResolvedValue(mockResponse);

      const result = await client.rename('/old/path.txt', '/new/path.txt');

      expect(result).toEqual({
        type: 'ok',
        result: {},
      });
      expect(pintApi.performFileAction).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { path: '/old/path.txt' },
        body: {
          action: 'move',
          destination: '/new/path.txt',
        },
      });
    });

    it('should handle API error response', async () => {
      const mockResponse = createMockResponse(undefined, { message: 'Destination exists' });
      vi.mocked(pintApi.performFileAction).mockResolvedValue(mockResponse);

      const result = await client.rename('/old/path.txt', '/new/path.txt');

      expect(result).toEqual({
        type: 'error',
        error: 'Destination exists',
        errno: null,
      });
    });
  });

  describe('watch', () => {
    it('should throw not implemented error', async () => {
      await expect(
        client.watch('/test', {}, () => {})
      ).rejects.toThrow('Not implemented');
    });
  });

  describe('download', () => {
    it('should throw not implemented error', async () => {
      await expect(
        client.download('/test')
      ).rejects.toThrow('Not implemented');
    });
  });
});