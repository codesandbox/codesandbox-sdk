import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PintFsClient } from '../src/PintClient/fs'
import { Client } from '../src/api-clients/pint/client'
import * as pintApi from '../src/api-clients/pint'

// Mock the pint API functions
vi.mock('../src/api-clients/pint', () => ({
  createWatcher: vi.fn(),
  createFile: vi.fn(),
  readFile: vi.fn(),
  listDirectory: vi.fn(),
  deleteDirectory: vi.fn(),
  createDirectory: vi.fn(),
  getFileStat: vi.fn(),
  performFileAction: vi.fn(),
}))

describe('PintFsClient filesystem watcher', () => {
  let fsClient: PintFsClient
  let mockApiClient: Client
  let mockCreateWatcher: any

  beforeEach(() => {
    // Create a mock API client
    mockApiClient = {} as Client

    // Create instance of PintFsClient
    fsClient = new PintFsClient(mockApiClient)

    // Get reference to mocked functions
    mockCreateWatcher = vi.mocked(pintApi.createWatcher)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully start watching a directory', async () => {
    const path = '/test/directory'
    const options = { recursive: true, excludes: ['*.log', 'node_modules/*'] }
    const onEvent = vi.fn()

    // Mock the stream generator
    async function* mockStream() {
      yield 'data: {"paths": ["/test/directory/file1.txt"], "type": "add"}'
      yield 'data: {"paths": ["/test/directory/file2.txt"], "type": "change"}'
    }

    // Mock createWatcher to return a stream
    mockCreateWatcher.mockResolvedValue({
      stream: mockStream()
    })

    // Call watch method
    const result = await fsClient.watch(path, options, onEvent)

    // Verify the result
    expect(result.type).toBe('success')
    expect(result).toHaveProperty('dispose')

    // Verify createWatcher was called with correct parameters
    expect(mockCreateWatcher).toHaveBeenCalledWith({
      client: mockApiClient,
      path: { path },
      query: {
        recursive: true,
        ignorePatterns: ['*.log', 'node_modules/*']
      },
      signal: expect.any(AbortSignal)
    })

    // Wait a bit for the async stream processing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify events were parsed and fired
    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenCalledWith({
      paths: ['/test/directory/file1.txt'],
      type: 'add'
    })
    expect(onEvent).toHaveBeenCalledWith({
      paths: ['/test/directory/file2.txt'],
      type: 'change'
    })
  })

  it('should handle watcher with minimal options', async () => {
    const path = '/simple/path'
    const options = {}
    const onEvent = vi.fn()

    // Mock empty stream
    async function* mockStream() {
      // Empty stream
    }

    mockCreateWatcher.mockResolvedValue({
      stream: mockStream()
    })

    const result = await fsClient.watch(path, options, onEvent)

    expect(result.type).toBe('success')
    expect(mockCreateWatcher).toHaveBeenCalledWith({
      client: mockApiClient,
      path: { path },
      query: {
        recursive: undefined,
        ignorePatterns: undefined
      },
      signal: expect.any(AbortSignal)
    })
  })

  it('should handle filesystem events correctly', async () => {
    const path = '/test/path'
    const options = { recursive: false }
    const onEvent = vi.fn()

    // Mock stream with different event types
    async function* mockStream() {
      yield 'data: {"paths": ["/test/path/new-file.txt"], "type": "add"}'
      yield 'data: {"paths": ["/test/path/modified-file.txt"], "type": "change"}'
      yield 'data: {"paths": ["/test/path/deleted-file.txt"], "type": "remove"}'
    }

    mockCreateWatcher.mockResolvedValue({
      stream: mockStream()
    })

    const result = await fsClient.watch(path, options, onEvent)
    expect(result.type).toBe('success')

    // Wait for stream processing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify all event types were handled
    expect(onEvent).toHaveBeenCalledTimes(3)
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      paths: ['/test/path/new-file.txt'],
      type: 'add'
    })
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      paths: ['/test/path/modified-file.txt'],
      type: 'change'
    })
    expect(onEvent).toHaveBeenNthCalledWith(3, {
      paths: ['/test/path/deleted-file.txt'],
      type: 'remove'
    })
  })

  it('should handle malformed stream events gracefully', async () => {
    const path = '/test/path'
    const options = {}
    const onEvent = vi.fn()

    // Mock stream with malformed data
    async function* mockStream() {
      yield 'data: {"paths": ["/test/path/good-file.txt"], "type": "add"}'
      yield 'data: invalid json'
      yield 'data: {"paths": ["/test/path/another-good-file.txt"], "type": "change"}'
    }

    mockCreateWatcher.mockResolvedValue({
      stream: mockStream()
    })

    // Spy on console.warn to verify error handling
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await fsClient.watch(path, options, onEvent)
    expect(result.type).toBe('success')

    // Wait for stream processing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify only valid events were processed
    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      paths: ['/test/path/good-file.txt'],
      type: 'add'
    })
    expect(onEvent).toHaveBeenNthCalledWith(2, {
      paths: ['/test/path/another-good-file.txt'],
      type: 'change'
    })

    // Verify warning was logged for malformed data
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse filesystem watch event:',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it('should allow disposal of watcher', async () => {
    const path = '/test/path'
    const options = {}
    const onEvent = vi.fn()

    // Mock stream that would run indefinitely
    async function* mockStream() {
      let count = 0
      while (true) {
        yield `data: {"paths": ["/test/path/file${count}.txt"], "type": "add"}`
        count++
        // Add a small delay to prevent tight loop
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    mockCreateWatcher.mockResolvedValue({
      stream: mockStream()
    })

    const result = await fsClient.watch(path, options, onEvent)
    expect(result.type).toBe('success')
    
    if (result.type === 'success') {
      expect(typeof result.dispose).toBe('function')

      // Let it run for a bit
      await new Promise(resolve => setTimeout(resolve, 50))

      // Dispose the watcher
      result.dispose()

      // The dispose function should abort the controller
      expect(() => result.dispose()).not.toThrow()
    }
  })

  it('should handle createWatcher promise rejection', async () => {
    const path = '/test/path'
    const options = {}
    const onEvent = vi.fn()

    // Mock createWatcher to reject
    mockCreateWatcher.mockRejectedValue(new Error('Network error'))

    const result = await fsClient.watch(path, options, onEvent)

    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.error).toBe('Network error')
      expect(result.errno).toBe(null)
    }
  })

  it('should handle unknown errors', async () => {
    const path = '/test/path'
    const options = {}
    const onEvent = vi.fn()

    // Mock createWatcher to reject with non-Error
    mockCreateWatcher.mockRejectedValue('String error')

    const result = await fsClient.watch(path, options, onEvent)

    expect(result.type).toBe('error')
    if (result.type === 'error') {
      expect(result.error).toBe('Unknown error')
      expect(result.errno).toBe(null)
    }
  })
})