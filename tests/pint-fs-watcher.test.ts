import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as http from 'node:http'
import { PintFsClient } from '../src/PintClient/fs'
import { createClient, createConfig } from '../src/api-clients/pint/client'

/**
 * Creates a minimal mock server that mimics pint's SSE watcher endpoint.
 * Mirrors the Go test helper `setupV1TestServer` in the pint project.
 *
 * The server guarantees the watcher is active before sending 200 OK,
 * just like pint's `CreateWatcher` uses the `ready` channel.
 */
function createMockPintServer() {
  let activeSseResponse: http.ServerResponse | null = null

  const server = http.createServer((req, res) => {
    if (req.url?.includes('/api/v1/stream/directories/watcher/')) {
      // Simulate pint: watcher is set up synchronously before headers are written.
      // The 200 OK signals to the client that the watcher is fully active.
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.flushHeaders()
      activeSseResponse = res
      req.on('close', () => {
        activeSseResponse = null
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  return {
    server,
    /** Send a filesystem event over the active SSE connection. */
    sendEvent(event: { paths: string[]; type: string }) {
      activeSseResponse?.write(`data: ${JSON.stringify(event)}\n\n`)
    },
    isConnected() {
      return activeSseResponse !== null
    },
  }
}

describe('PintFsClient filesystem watcher', () => {
  let server: http.Server
  let sendEvent: (event: { paths: string[]; type: string }) => void
  let isConnected: () => boolean
  let fsClient: PintFsClient
  let port: number
  let activeWatcher: { dispose(): void } | null = null

  beforeEach(async () => {
    activeWatcher = null
    const mock = createMockPintServer()
    server = mock.server
    sendEvent = mock.sendEvent
    isConnected = mock.isConnected

    await new Promise<void>((resolve) => server.listen(0, resolve))
    port = (server.address() as http.AddressInfo).port

    const apiClient = createClient(
      createConfig({
        baseUrl: `http://localhost:${port}`,
        headers: { Authorization: 'Bearer test-token' },
      })
    )
    fsClient = new PintFsClient(apiClient)
  })

  afterEach(async () => {
    // Dispose any active watcher to close the SSE connection so server.close() can complete.
    activeWatcher?.dispose()
    activeWatcher = null
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('watch() resolves only after the server has confirmed the watcher is active (200 OK)', async () => {
    // Mirrors TestFileWatcherIsReadyWhenConnectionEstablished:
    // The watcher must be active the moment watch() resolves — no sleep needed.
    const result = await fsClient.watch('/sandbox/project', { recursive: true }, () => {})

    expect(result.type).toBe('success')
    expect(isConnected()).toBe(true)

    if (result.type === 'success') activeWatcher = result
  })

  it('delivers SSE events to onEvent immediately after watch() resolves', async () => {
    // Mirrors the core of TestFileWatcherIsReadyWhenConnectionEstablished:
    // send an event right after watch() resolves, no sleep.
    const events: Array<{ paths: string[]; type: string }> = []

    const result = await fsClient.watch('/sandbox/project', { recursive: true }, (event) => {
      events.push(event as any)
    })

    expect(result.type).toBe('success')
    if (result.type === 'success') activeWatcher = result

    // Send event immediately — watcher is already active, no sleep needed.
    sendEvent({ paths: ['/sandbox/project/new-file.txt'], type: 'ADD' })

    // Wait for the event loop to process the SSE data.
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ paths: ['/sandbox/project/new-file.txt'], type: 'ADD' })
  })

  it('delivers multiple event types (ADD, CHANGE, REMOVE)', async () => {
    const events: Array<{ paths: string[]; type: string }> = []

    const result = await fsClient.watch('/sandbox/project', {}, (event) => {
      events.push(event as any)
    })
    expect(result.type).toBe('success')
    if (result.type === 'success') activeWatcher = result

    sendEvent({ paths: ['/sandbox/project/a.txt'], type: 'ADD' })
    sendEvent({ paths: ['/sandbox/project/b.txt'], type: 'CHANGE' })
    sendEvent({ paths: ['/sandbox/project/c.txt'], type: 'REMOVE' })

    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(events).toHaveLength(3)
    expect(events[0].type).toBe('ADD')
    expect(events[1].type).toBe('CHANGE')
    expect(events[2].type).toBe('REMOVE')
  })

  it('returns error when server returns non-200', async () => {
    // Close the default server and replace with one that returns 400.
    await new Promise<void>((resolve) => server.close(() => resolve()))
    server = http.createServer((_req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'Directory not found', code: 400 }))
    })
    await new Promise<void>((resolve) => server.listen(port, resolve))

    const result = await fsClient.watch('/nonexistent/path', {}, () => {})

    expect(result.type).toBe('error')
  })

  it('stops receiving events after dispose()', async () => {
    const events: Array<{ paths: string[]; type: string }> = []

    const result = await fsClient.watch('/sandbox/project', {}, (event) => {
      events.push(event as any)
    })
    expect(result.type).toBe('success')
    if (result.type !== 'success') return

    sendEvent({ paths: ['/sandbox/project/before.txt'], type: 'ADD' })
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(events).toHaveLength(1)

    result.dispose()
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Any events sent after dispose should not arrive.
    sendEvent({ paths: ['/sandbox/project/after.txt'], type: 'ADD' })
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(events).toHaveLength(1)
  })
})
