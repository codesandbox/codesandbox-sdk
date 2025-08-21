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
    let forkRequestCount = 0
    
    // Mock fork to fail once - should fail immediately since fork doesn't retry
    const forkScope = nock('https://api.codesandbox.io')
      .post('/sandbox/pcz35m/fork')
      .reply(500, () => {
        forkRequestCount++
        return { error: { errors: ['Fork failed'] } }
      })

    const sdk = new CodeSandbox()
    
    // Should fail immediately without retries
    const startTime = Date.now()
    await expect(sdk.sandboxes.create()).rejects.toThrow()
    const duration = Date.now() - startTime
    
    // Should fail quickly (no retry delays)
    expect(duration).toBeLessThan(1000)
    expect(forkScope.isDone()).toBe(true)
    expect(forkRequestCount).toBe(1) // Should only make 1 request (no retries)
  })

  it('should retry start VM failures and eventually succeed', async () => {
    let startVMRequestCount = 0
    
    // Mock successful fork
    const forkScope = mockForkSandboxSuccess('test-sandbox-start-retry')

    // Mock start VM to fail twice
    const failureScope = nock('https://api.codesandbox.io')
      .post(/\/vm\/.*\/start/)
      .times(2)
      .reply(500, () => {
        startVMRequestCount++
        return { error: { errors: ['Start failed'] } }
      })
    
    // Then succeed on 3rd attempt
    const startScope = nock('https://api.codesandbox.io')
      .post(/\/vm\/.*\/start/)
      .reply(200, () => {
        startVMRequestCount++
        return {
          data: {
            bootup_type: 'CLEAN',
            cluster: 'test-cluster',
            pitcher_url: `wss://pitcher.codesandbox.io/test-sandbox-start-retry`,
            workspace_path: '/project/sandbox',
            user_workspace_path: '/project/sandbox',
            pitcher_manager_version: '1.0.0',
            pitcher_version: '1.0.0',
            latest_pitcher_version: '1.0.0',
            pitcher_token: `pitcher-token-retry`
          }
        }
      })

    const sdk = new CodeSandbox()
    
    // Should succeed after start VM retries
    const sandbox = await sdk.sandboxes.create()
    
    expect(sandbox).toBeDefined()
    expect(sandbox.id).toBe('test-sandbox-start-retry')
    expect(forkScope.isDone()).toBe(true)
    expect(failureScope.isDone()).toBe(true)
    expect(startScope.isDone()).toBe(true)
    expect(startVMRequestCount).toBe(3) // Should make 3 requests (2 failures + 1 success)
  }, 10000) // Longer timeout for retries

  it('should fail create after start VM exhausts all retries', async () => {
    let startVMRequestCount = 0
    
    // Mock successful fork
    const forkScope = mockForkSandboxSuccess('test-sandbox-start-fail')

    // Mock start VM to fail all 3 retry attempts
    const failureScope = nock('https://api.codesandbox.io')
      .post(/\/vm\/.*\/start/)
      .times(3)
      .reply(500, () => {
        startVMRequestCount++
        return { error: { errors: ['Persistent start failure'] } }
      })

    const sdk = new CodeSandbox()
    
    // Should fail after exhausting start VM retries
    await expect(sdk.sandboxes.create()).rejects.toThrow()
    
    expect(forkScope.isDone()).toBe(true)
    expect(failureScope.isDone()).toBe(true)
    expect(startVMRequestCount).toBe(3) // Should make exactly 3 retry attempts
  }, 10000) // Longer timeout for retries

  it('should validate retry timing for start VM failures', async () => {
    let startVMRequestCount = 0
    
    // Mock successful fork
    const forkScope = mockForkSandboxSuccess('test-sandbox-timing')

    // Mock start VM to fail twice
    const failureScope = nock('https://api.codesandbox.io')
      .post(/\/vm\/.*\/start/)
      .times(2)
      .reply(500, () => {
        startVMRequestCount++
        return { error: { errors: ['Start failed'] } }
      })
    
    // Then succeed on 3rd attempt
    const startScope = nock('https://api.codesandbox.io')
      .post(/\/vm\/.*\/start/)
      .reply(200, () => {
        startVMRequestCount++
        return {
          data: {
            bootup_type: 'CLEAN',
            cluster: 'test-cluster',
            pitcher_url: `wss://pitcher.codesandbox.io/test-sandbox-timing`,
            workspace_path: '/project/sandbox',
            user_workspace_path: '/project/sandbox',
            pitcher_manager_version: '1.0.0',
            pitcher_version: '1.0.0',
            latest_pitcher_version: '1.0.0',
            pitcher_token: `pitcher-token-timing`
          }
        }
      })

    const sdk = new CodeSandbox()
    
    const startTime = Date.now()
    const sandbox = await sdk.sandboxes.create()
    const duration = Date.now() - startTime
    
    // Should take at least 400ms (2 retries × 200ms delay each)
    expect(duration).toBeGreaterThanOrEqual(300) // Allow some tolerance
    expect(sandbox).toBeDefined()
    expect(sandbox.id).toBe('test-sandbox-timing')
    expect(forkScope.isDone()).toBe(true)
    expect(failureScope.isDone()).toBe(true)
    expect(startScope.isDone()).toBe(true)
    expect(startVMRequestCount).toBe(3) // Should make 3 requests (2 failures + 1 success)
  }, 10000) // Longer timeout for retries
})