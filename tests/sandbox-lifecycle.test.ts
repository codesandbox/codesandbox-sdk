import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CodeSandbox } from '../src/index'
import { 
  mockHibernateSuccess,
  mockHibernateFailure,
  mockStartVMSuccess,
  mockShutdownSuccess,
  mockShutdownFailure,
  mockStartVMFailure,
  setupTestEnvironment, 
  cleanupTestEnvironment 
} from './test-utils'

describe('Sandbox lifecycle operations', () => {
  beforeEach(() => {
    setupTestEnvironment()
  })

  afterEach(() => {
    cleanupTestEnvironment()
  })

  it('should successfully hibernate a sandbox', async () => {
    const sandboxId = 'test-sandbox-hibernate'
    
    // Mock hibernate API call
    const hibernateScope = mockHibernateSuccess(sandboxId)

    const sdk = new CodeSandbox()
    
    // Test hibernate operation
    await expect(sdk.sandboxes.hibernate(sandboxId)).resolves.not.toThrow()
    
    // Verify API call was made
    expect(hibernateScope.isDone()).toBe(true)
  })

  it('should successfully resume a sandbox', async () => {
    const sandboxId = 'test-sandbox-resume'
    
    // Mock resume (startVm) API call
    const resumeScope = mockStartVMSuccess(sandboxId, 'RESUME')

    const sdk = new CodeSandbox()
    
    // Test resume operation
    const sandbox = await sdk.sandboxes.resume(sandboxId)
    
    // Verify sandbox was resumed successfully
    expect(sandbox).toBeDefined()
    expect(sandbox.id).toBe(sandboxId)
    expect(sandbox.bootupType).toBe('RESUME')
    expect(resumeScope.isDone()).toBe(true)
  })

  it('should successfully restart a sandbox', async () => {
    const sandboxId = 'test-sandbox-restart'
    
    // Mock shutdown API call
    const shutdownScope = mockShutdownSuccess(sandboxId)

    // Mock start VM API call (after shutdown)
    const startScope = mockStartVMSuccess(sandboxId, 'CLEAN')

    const sdk = new CodeSandbox()
    
    // Test restart operation
    const sandbox = await sdk.sandboxes.restart(sandboxId)
    
    // Verify sandbox was restarted successfully
    expect(sandbox).toBeDefined()
    expect(sandbox.id).toBe(sandboxId)
    expect(sandbox.bootupType).toBe('CLEAN')
    expect(shutdownScope.isDone()).toBe(true)
    expect(startScope.isDone()).toBe(true)
  })

  it('should retry API calls on failure and eventually succeed', async () => {
    const sandboxId = 'test-sandbox-retry-success'
    
    // Mock hibernate API to fail twice, then succeed on 3rd attempt
    mockHibernateFailure(sandboxId, 2, 'Server error')
    const hibernateScope = mockHibernateSuccess(sandboxId)

    const sdk = new CodeSandbox()
    
    // Test should succeed after retries
    await expect(sdk.sandboxes.hibernate(sandboxId)).resolves.not.toThrow()
    
    // Verify all retry attempts were made
    expect(hibernateScope.isDone()).toBe(true)
  }, 10000) // Longer timeout for retry test

  it('should fail after exhausting all retry attempts', async () => {
    const sandboxId = 'test-sandbox-retry-fail'
    
    // Mock hibernate API to fail 3 times (exhaust retries)
    mockHibernateFailure(sandboxId, 3, 'Persistent server error')

    const sdk = new CodeSandbox()
    
    // Test should fail after all retries are exhausted
    await expect(sdk.sandboxes.hibernate(sandboxId)).rejects.toThrow()
  }, 10000) // Longer timeout for retry test

  it('should handle restart failure during shutdown phase', async () => {
    const sandboxId = 'test-sandbox-restart-fail'
    
    // Mock shutdown to fail
    mockShutdownFailure(sandboxId, 3, 'Shutdown failed')

    const sdk = new CodeSandbox()
    
    // Test should fail during shutdown phase
    await expect(sdk.sandboxes.restart(sandboxId)).rejects.toThrow('Failed to shutdown VM')
  })

  it('should handle restart failure during start phase', async () => {
    const sandboxId = 'test-sandbox-restart-start-fail'
    
    // Mock successful shutdown
    const shutdownScope = mockShutdownSuccess(sandboxId)

    // Mock start VM to fail
    mockStartVMFailure(3, 'Start failed')

    const sdk = new CodeSandbox()
    
    // Test should fail during start phase
    await expect(sdk.sandboxes.restart(sandboxId)).rejects.toThrow('Failed to start VM')
    
    // Verify both phases were attempted
    expect(shutdownScope.isDone()).toBe(true)
  })
})