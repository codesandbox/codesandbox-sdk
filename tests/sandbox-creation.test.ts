import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import nock from 'nock'
import { CodeSandbox } from '../src/index'
import { 
  mockForkSandboxSuccess, 
  mockStartVMSuccess, 
  setupTestEnvironment, 
  cleanupTestEnvironment 
} from './test-utils'

describe('Sandbox Creation', () => {
  beforeEach(() => {
    setupTestEnvironment()
  })

  afterEach(() => {
    cleanupTestEnvironment()
  })

  it('should successfully create and start a sandbox', async () => {
    // Mock the fork sandbox API call (pcz35m is the default template)
    const forkScope = mockForkSandboxSuccess('test-sandbox-123', {
      title: 'Test Sandbox',
      description: 'Integration test sandbox',
      privacy: 1,
      tags: ['integration-test', 'sdk']
    })

    // Mock the start VM API call - use regex to match any ID
    const startScope = mockStartVMSuccess('test-sandbox-123')

    // Initialize SDK
    const sdk = new CodeSandbox()
    
    // Create sandbox
    const sandbox = await sdk.sandboxes.create({
      title: 'Test Sandbox',
      description: 'Integration test sandbox',
      privacy: 'public',
      tags: ['integration-test']
    })

    // Verify sandbox was created successfully
    expect(sandbox).toBeDefined()
    expect(sandbox.id).toBe('test-sandbox-123')
    
    // Verify all API calls were made
    expect(forkScope.isDone()).toBe(true)
    expect(startScope.isDone()).toBe(true)
  }, 10000) // 10 second timeout for integration test

  it('should use default template when no id is provided', async () => {
    // Mock default template call - pcz35m is the default template
    const forkScope = mockForkSandboxSuccess('default-sandbox-456')

    const startScope = mockStartVMSuccess('default-sandbox-456')

    const sdk = new CodeSandbox()
    
    // Create sandbox without specifying template id
    const sandbox = await sdk.sandboxes.create()

    expect(sandbox).toBeDefined()
    expect(sandbox.id).toBe('default-sandbox-456')
    expect(forkScope.isDone()).toBe(true)
    expect(startScope.isDone()).toBe(true)
  })

  it('should handle API errors gracefully', async () => {
    // Mock fork sandbox failure
    nock('https://api.codesandbox.io')
      .post('/sandbox/pcz35m/fork')
      .reply(500, { message: 'Internal server error' })

    const sdk = new CodeSandbox()
    
    // Expect the creation to throw an error
    await expect(sdk.sandboxes.create()).rejects.toThrow()
  })
})