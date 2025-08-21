import nock from 'nock'

export const mockForkSandboxSuccess = (sandboxId: string, options?: {
  title?: string
  description?: string
  privacy?: number
  tags?: string[]
}) => {
  return nock('https://api.codesandbox.io')
    .post('/sandbox/pcz35m/fork', {
      privacy: options?.privacy ?? 1,
      ...(options?.title && { title: options.title }),
      ...(options?.description && { description: options.description }),
      tags: options?.tags ?? ['sdk'],
      path: '/SDK'
    })
    .reply(200, {
      data: {
        id: sandboxId,
        title: options?.title ?? 'Test Sandbox',
        description: options?.description,
        privacy: options?.privacy ?? 1,
        tags: options?.tags ?? ['sdk'],
        created_at: '2025-01-21T12:00:00Z',
        updated_at: '2025-01-21T12:00:00Z'
      }
    })
}

export const mockStartVMSuccess = (sandboxId: string, bootupType: 'CLEAN' | 'RESUME' = 'CLEAN') => {
  return nock('https://api.codesandbox.io')
    .post(/\/vm\/.*\/start/)
    .reply(200, {
      data: {
        bootup_type: bootupType,
        cluster: 'test-cluster',
        pitcher_url: `wss://pitcher.codesandbox.io/${sandboxId}`,
        workspace_path: '/project/sandbox',
        user_workspace_path: '/project/sandbox',
        pitcher_manager_version: '1.0.0',
        pitcher_version: '1.0.0',
        latest_pitcher_version: '1.0.0',
        pitcher_token: `pitcher-token-${sandboxId.split('-').pop()}`
      }
    })
}

export const mockStartVMFailure = (times: number = 1, errorMessage: string = 'Start failed') => {
  return nock('https://api.codesandbox.io')
    .post(/\/vm\/.*\/start/)
    .times(times)
    .reply(500, { error: { errors: [errorMessage] } })
}

export const mockHibernateSuccess = (sandboxId: string) => {
  return nock('https://api.codesandbox.io')
    .post(`/vm/${sandboxId}/hibernate`)
    .reply(200, {
      data: {
        success: true
      }
    })
}

export const mockHibernateFailure = (sandboxId: string, times: number = 1, errorMessage: string = 'Server error') => {
  return nock('https://api.codesandbox.io')
    .post(`/vm/${sandboxId}/hibernate`)
    .times(times)
    .reply(500, { error: { errors: [errorMessage] } })
}

export const mockShutdownSuccess = (sandboxId: string) => {
  return nock('https://api.codesandbox.io')
    .post(`/vm/${sandboxId}/shutdown`)
    .reply(200, {
      data: {
        success: true
      }
    })
}

export const mockShutdownFailure = (sandboxId: string, times: number = 1, errorMessage: string = 'Shutdown failed') => {
  return nock('https://api.codesandbox.io')
    .post(`/vm/${sandboxId}/shutdown`)
    .times(times)
    .reply(500, { error: { errors: [errorMessage] } })
}

export const setupTestEnvironment = () => {
  process.env.CSB_API_KEY = 'csb_test_key_123'
  nock.cleanAll()
}

export const cleanupTestEnvironment = () => {
  if (!nock.isDone()) {
    console.error('Unused nock interceptors:', nock.pendingMocks())
  }
  nock.cleanAll()
}