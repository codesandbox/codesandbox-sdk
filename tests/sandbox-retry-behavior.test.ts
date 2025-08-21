import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import nock from 'nock'
import { CodeSandbox } from '../src/index'
import { 
  mockForkSandboxSuccess, 
  mockStartVMSuccess, 
  mockStartVMFailure, 
  setupTestEnvironment, 
  cleanupTestEnvironment 
} from './test-utils'

describe('Create operation retry behavior', () => {
  beforeEach(() => {
    setupTestEnvironment()
  })

  afterEach(() => {
    cleanupTestEnvironment()
  })

  it('should fail immediately on fork API error (no retry for fork)', async () => {
    // Mock fork to fail once - should fail immediately since fork doesn't retry
    const forkScope = nock('https://api.codesandbox.io')
      .post('/sandbox/pcz35m/fork')
      .reply(500, { error: { errors: ['Fork failed'] } })

    const sdk = new CodeSandbox()
    
    // Should fail immediately without retries
    const startTime = Date.now()
    await expect(sdk.sandboxes.create()).rejects.toThrow()
    const duration = Date.now() - startTime
    
    // Should fail quickly (no retry delays)
    expect(duration).toBeLessThan(1000)
    expect(forkScope.isDone()).toBe(true)
  })

  it('should retry start VM failures and eventually succeed', async () => {
    // Mock successful fork
    const forkScope = mockForkSandboxSuccess('test-sandbox-start-retry')

    // Mock start VM to fail twice, then succeed on 3rd attempt
    mockStartVMFailure(2, 'Start failed')
    const startScope = mockStartVMSuccess('test-sandbox-start-retry')

    const sdk = new CodeSandbox()
    
    // Should succeed after start VM retries
    const sandbox = await sdk.sandboxes.create()
    
    expect(sandbox).toBeDefined()
    expect(sandbox.id).toBe('test-sandbox-start-retry')
    expect(forkScope.isDone()).toBe(true)
    expect(startScope.isDone()).toBe(true)
  }, 10000) // Longer timeout for retries

  it('should fail create after start VM exhausts all retries', async () => {
    // Mock successful fork
    const forkScope = mockForkSandboxSuccess('test-sandbox-start-fail')

    // Mock start VM to fail all 3 retry attempts
    mockStartVMFailure(3, 'Persistent start failure')

    const sdk = new CodeSandbox()
    
    // Should fail after exhausting start VM retries
    await expect(sdk.sandboxes.create()).rejects.toThrow()
    
    expect(forkScope.isDone()).toBe(true)
  }, 10000) // Longer timeout for retries

  it('should validate retry timing for start VM failures', async () => {
    // Mock successful fork
    const forkScope = mockForkSandboxSuccess('test-sandbox-timing')

    // Mock start VM to fail twice (should take at least 400ms due to 200ms delays)
    mockStartVMFailure(2, 'Start failed')
    const startScope = mockStartVMSuccess('test-sandbox-timing')

    const sdk = new CodeSandbox()
    
    const startTime = Date.now()
    const sandbox = await sdk.sandboxes.create()
    const duration = Date.now() - startTime
    
    // Should take at least 400ms (2 retries × 200ms delay each)
    expect(duration).toBeGreaterThanOrEqual(300) // Allow some tolerance
    expect(sandbox).toBeDefined()
    expect(sandbox.id).toBe('test-sandbox-timing')
    expect(forkScope.isDone()).toBe(true)
    expect(startScope.isDone()).toBe(true)
  }, 10000) // Longer timeout for retries
})