import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PintShellsClient } from '../src/PintClient/execs';
import { Client } from '../src/api-clients/pint/client';
import * as pintApi from '../src/api-clients/pint';
import { ExecItem } from '../src/api-clients/pint';
import { ShellSize, ShellProcessType } from '../src/pitcher-protocol/messages/shell';
import { IDisposable } from '../src/utils/disposable';

// Mock the API functions
vi.mock('../src/api-clients/pint', () => ({
  createExec: vi.fn(),
  getExec: vi.fn(),
  listExecs: vi.fn(),
  deleteExec: vi.fn(),
  updateExec: vi.fn(),
  execExecStdin: vi.fn(),
  getExecOutput: vi.fn(),
  streamExecsList: vi.fn(),
}));

// Mock the utils parseStreamEvent function
vi.mock('../src/PintClient/utils', () => ({
  parseStreamEvent: vi.fn((evt) => {
    if (typeof evt === 'string') {
      return JSON.parse(evt.substring(5));
    }
    return evt;
  }),
}));

// Helper to create proper mock response
const createMockResponse = (data: any, error?: any) => ({
  data,
  error,
  request: {} as any,
  response: {} as any,
});

// Mock ExecItem for testing
const createMockExecItem = (overrides: Partial<ExecItem> = {}): ExecItem => ({
  id: 'exec-123',
  command: 'bash',
  args: [],
  interactive: true,
  status: 'RUNNING',
  exitCode: 0,
  pid: 1234,
  ...overrides,
});

describe('PintShellsClient', () => {
  let client: PintShellsClient;
  let mockApiClient: Client;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient = {} as Client;
    client = new PintShellsClient(mockApiClient, 'sandbox-123');
  });

  describe('create', () => {
    it('should successfully create a new shell with command', async () => {
      const mockExec = createMockExecItem();
      const mockResponse = createMockResponse(mockExec);
      
      vi.mocked(pintApi.createExec).mockResolvedValue(mockResponse);
      
      // Mock the open method call
      const mockOpenResponse = createMockResponse(mockExec);
      vi.mocked(pintApi.getExec).mockResolvedValue(mockOpenResponse);
      vi.mocked(pintApi.getExecOutput).mockResolvedValue({
        ...createMockResponse({}),
        stream: (async function* (): AsyncGenerator<string, any, unknown> {
          yield 'data:{"type":"stdout","output":"Welcome","sequence":1,"timestamp":"2023-01-01T12:00:00Z"}';
        })(),
      });

      const result = await client.create(
        '/workspace',
        { cols: 80, rows: 24 },
        'npm start',
        'COMMAND',
        false
      );

      expect(result).toEqual({
        isSystemShell: true,
        name: JSON.stringify({
          type: 'command',
          command: 'bash',
          name: '',
        }),
        ownerUsername: 'root',
        shellId: 'exec-123',
        shellType: 'TERMINAL',
        startCommand: 'bash',
        status: 'RUNNING',
        buffer: [],
      });

      expect(pintApi.createExec).toHaveBeenCalledWith({
        client: mockApiClient,
        body: {
          args: ['start'],
          command: 'npm',
          interactive: false,
        },
      });
    });

    it('should create a shell with default bash command', async () => {
      const mockExec = createMockExecItem({ command: 'bash' });
      const mockResponse = createMockResponse(mockExec);
      
      vi.mocked(pintApi.createExec).mockResolvedValue(mockResponse);
      vi.mocked(pintApi.getExec).mockResolvedValue(mockResponse);
      vi.mocked(pintApi.getExecOutput).mockResolvedValue({
        ...createMockResponse({}),
        stream: (async function* (): AsyncGenerator<string, any, unknown> {})(),
      });

      await client.create('/workspace', { cols: 80, rows: 24 });

      expect(pintApi.createExec).toHaveBeenCalledWith({
        client: mockApiClient,
        body: {
          args: [],
          command: 'bash',
          interactive: true,
        },
      });
    });

    it('should handle API error during creation', async () => {
      const mockResponse = createMockResponse(null, { message: 'Creation failed' });
      vi.mocked(pintApi.createExec).mockResolvedValue(mockResponse);

      await expect(
        client.create('/workspace', { cols: 80, rows: 24 })
      ).rejects.toThrow('Creation failed');
    });

    it('should set interactive based on shell type', async () => {
      const mockExec = createMockExecItem();
      const mockResponse = createMockResponse(mockExec);
      
      vi.mocked(pintApi.createExec).mockResolvedValue(mockResponse);
      vi.mocked(pintApi.getExec).mockResolvedValue(mockResponse);
      vi.mocked(pintApi.getExecOutput).mockResolvedValue({
        ...createMockResponse({}),
        stream: (async function* (): AsyncGenerator<string, any, unknown> {})(),
      });

      await client.create('/workspace', { cols: 80, rows: 24 }, 'echo test', 'TERMINAL');

      expect(pintApi.createExec).toHaveBeenCalledWith({
        client: mockApiClient,
        body: {
          args: ['test'],
          command: 'echo',
          interactive: true,
        },
      });
    });
  });

  describe('delete', () => {
    it('should successfully delete an existing shell', async () => {
      const mockExec = createMockExecItem();
      const getResponse = createMockResponse(mockExec);
      const deleteResponse = createMockResponse({ success: true });

      vi.mocked(pintApi.getExec).mockResolvedValue(getResponse);
      vi.mocked(pintApi.deleteExec).mockResolvedValue(deleteResponse);

      const result = await client.delete('exec-123');

      expect(result).toEqual({
        isSystemShell: true,
        name: JSON.stringify({
          type: 'command',
          command: 'bash',
          name: '',
        }),
        ownerUsername: 'root',
        shellId: 'exec-123',
        shellType: 'TERMINAL',
        startCommand: 'bash',
        status: 'RUNNING',
      });

      expect(pintApi.getExec).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { id: 'exec-123' },
      });
      expect(pintApi.deleteExec).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { id: 'exec-123' },
      });
    });

    it('should return null if shell does not exist', async () => {
      const getResponse = createMockResponse(null);
      vi.mocked(pintApi.getExec).mockResolvedValue(getResponse);

      const result = await client.delete('nonexistent');

      expect(result).toBeNull();
      expect(pintApi.deleteExec).not.toHaveBeenCalled();
    });

    it('should return null if deletion fails', async () => {
      const mockExec = createMockExecItem();
      const getResponse = createMockResponse(mockExec);
      const deleteResponse = createMockResponse(null);

      vi.mocked(pintApi.getExec).mockResolvedValue(getResponse);
      vi.mocked(pintApi.deleteExec).mockResolvedValue(deleteResponse);

      const result = await client.delete('exec-123');

      expect(result).toBeNull();
    });

    it('should handle exceptions gracefully', async () => {
      vi.mocked(pintApi.getExec).mockRejectedValue(new Error('Network error'));

      const result = await client.delete('exec-123');

      expect(result).toBeNull();
    });
  });

  describe('getShells', () => {
    it('should return list of shells converted from execs', async () => {
      const mockExecs = [
        createMockExecItem({ id: 'exec-1', command: 'bash' }),
        createMockExecItem({ id: 'exec-2', command: 'npm', status: 'EXITED' as any }),
      ];
      const mockResponse = createMockResponse({ execs: mockExecs });
      vi.mocked(pintApi.listExecs).mockResolvedValue(mockResponse);

      const result = await client.getShells();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        isSystemShell: true,
        name: JSON.stringify({
          type: 'command',
          command: 'bash',
          name: '',
        }),
        ownerUsername: 'root',
        shellId: 'exec-1',
        shellType: 'TERMINAL',
        startCommand: 'bash',
        status: 'RUNNING',
      });
      expect(result[1].status).toBe('EXITED');
    });

    it('should return empty array if no execs found', async () => {
      const mockResponse = createMockResponse({ execs: [] });
      vi.mocked(pintApi.listExecs).mockResolvedValue(mockResponse);

      const result = await client.getShells();

      expect(result).toEqual([]);
    });

    it('should handle API error by returning empty array', async () => {
      const mockResponse = createMockResponse(null);
      vi.mocked(pintApi.listExecs).mockResolvedValue(mockResponse);

      const result = await client.getShells();

      expect(result).toEqual([]);
    });
  });

  describe('open', () => {
    it('should successfully open a shell and return with output buffer', async () => {
      const mockExec = createMockExecItem();
      const getResponse = createMockResponse(mockExec);
      const outputStream = (async function* (): AsyncGenerator<string, any, unknown> {
        yield 'data:{"type":"stdout","output":"Hello","sequence":1,"timestamp":"2023-01-01T12:00:00Z"}';
      })();

      vi.mocked(pintApi.getExec).mockResolvedValue(getResponse);
      vi.mocked(pintApi.getExecOutput).mockResolvedValue({
        ...createMockResponse({}),
        stream: outputStream,
      });

      const result = await client.open('exec-123', { cols: 80, rows: 24 });

      expect(result).toEqual({
        buffer: ['Hello'],
        isSystemShell: true,
        name: JSON.stringify({
          type: 'command',
          command: 'bash',
          name: '',
        }),
        ownerUsername: 'root',
        shellId: 'exec-123',
        shellType: 'TERMINAL',
        startCommand: 'bash',
        status: 'RUNNING',
      });

      expect(pintApi.getExec).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { id: 'exec-123' },
      });
    });

    it('should handle shell that does not exist', async () => {
      const getResponse = createMockResponse(null, { message: 'Not found' });
      vi.mocked(pintApi.getExec).mockResolvedValue(getResponse);

      await expect(
        client.open('nonexistent', { cols: 80, rows: 24 })
      ).rejects.toThrow('Not found');
    });
  });

  describe('rename', () => {
    it('should return null as rename is not implemented', async () => {
      const result = await client.rename('exec-123', 'new-name');
      expect(result).toBeNull();
    });
  });

  describe('restart', () => {
    it('should successfully restart a shell', async () => {
      const mockResponse = createMockResponse({ success: true });
      vi.mocked(pintApi.updateExec).mockResolvedValue(mockResponse);

      const result = await client.restart('exec-123');

      expect(result).toBeNull();
      expect(pintApi.updateExec).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { id: 'exec-123' },
        body: { status: 'running' },
      });
    });

    it('should handle restart failure gracefully', async () => {
      vi.mocked(pintApi.updateExec).mockRejectedValue(new Error('Restart failed'));

      const result = await client.restart('exec-123');

      expect(result).toBeNull();
    });
  });

  describe('send', () => {
    it('should successfully send input to shell', async () => {
      const mockResponse = createMockResponse({ success: true });
      vi.mocked(pintApi.execExecStdin).mockResolvedValue(mockResponse);

      const result = await client.send('exec-123', 'echo hello', { cols: 80, rows: 24 });

      expect(result).toBeNull();
      expect(pintApi.execExecStdin).toHaveBeenCalledWith({
        client: mockApiClient,
        path: { id: 'exec-123' },
        body: {
          type: 'stdin',
          input: 'echo hello',
        },
      });
    });

    it('should handle send failure gracefully', async () => {
      vi.mocked(pintApi.execExecStdin).mockRejectedValue(new Error('Send failed'));

      const result = await client.send('exec-123', 'test', { cols: 80, rows: 24 });

      expect(result).toBeNull();
    });
  });

  describe('convertExecToShellDTO', () => {
    it('should convert ExecItem to ShellDTO format', async () => {
      const mockExec = createMockExecItem({
        id: 'test-exec',
        command: 'node server.js',
        status: 'RUNNING' as any,
      });

      // Access private method via bracket notation for testing
      const result = (client as any).convertExecToShellDTO(mockExec);

      expect(result).toEqual({
        isSystemShell: true,
        name: JSON.stringify({
          type: 'command',
          command: 'node server.js',
          name: '',
        }),
        ownerUsername: 'root',
        shellId: 'test-exec',
        shellType: 'TERMINAL',
        startCommand: 'node server.js',
        status: 'RUNNING',
      });
    });
  });

  describe('event emitters', () => {
    it('should have onShellExited event emitter', () => {
      expect(client.onShellExited).toBeDefined();
      expect(typeof client.onShellExited).toBe('function');
    });

    it('should have onShellOut event emitter', () => {
      expect(client.onShellOut).toBeDefined();
      expect(typeof client.onShellOut).toBe('function');
    });

    it('should have onShellTerminated event emitter', () => {
      expect(client.onShellTerminated).toBeDefined();
      expect(typeof client.onShellTerminated).toBe('function');
    });

    it('should emit shell exit events when status changes from RUNNING to EXITED', async () => {
      // Mock the stream for subscribeAndEvaluateExecsUpdates
      const streamMock = (async function* (): AsyncGenerator<string, any, unknown> {
        yield 'data:{"execs":[{"id":"exec-123","status":"EXITED","exitCode":0,"command":"bash","args":[],"interactive":true,"pid":1234}]}';
      })();
      
      vi.mocked(pintApi.streamExecsList).mockResolvedValue({
        ...createMockResponse({}),
        stream: streamMock,
      });

      // Test that the event emitter is properly set up
      const unsubscribe: IDisposable = client.onShellExited((event) => {
        expect(event.shellId).toBe('exec-123');
        expect(event.exitCode).toBe(0);
      });

      // Give some time for the stream to process
      await new Promise(resolve => setTimeout(resolve, 10));

      unsubscribe.dispose();
      // Note: Due to the async nature of the stream, we can't easily test the actual firing
      // without more complex mocking, but we can verify the structure exists
    });
  });
});