import { generateJwtTokenForAuthIdentity } from '@core/auth/utils/generate-jwt-token.js'
import type { UpdateAuthIdentityDTO } from '@core/types/auth/mutations.js'
import type { IAuthModuleService } from '@core/types/auth/service.js'
import { Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { createWorkflow, setWorkflowEngine, WorkflowTerminalError } from '@core/workflows/types.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import jwt from 'jsonwebtoken'
import { vi } from 'vitest'
import type { SetAuthAppMetadataInput } from '../steps/set-auth-app-metadata.js'
import { setAuthAppMetadataStep } from '../steps/set-auth-app-metadata.js'

const JWT_SECRET = 'test-secret-for-unit-tests'

function setupWorkflowEngine(authService: Partial<IAuthModuleService>) {
  const container = createContainer()
  container.register({ [Modules.AUTH]: asValue(authService) })
  setWorkflowEngine(createSimpleWorkflowEngine(), container)
}

function makeTestWorkflow(input: SetAuthAppMetadataInput) {
  return createWorkflow<SetAuthAppMetadataInput, void>('test-set-auth-app-metadata', async (ctx, workflowInput) => {
    await setAuthAppMetadataStep(ctx, workflowInput)
  }).run(input)
}

test.describe('setAuthAppMetadataStep', () => {
  test('writes userId into app_metadata', async ({ dto, expect }) => {
    const identity = dto.generate.authIdentity()
    const updateCalls: Array<{ id: string; data: UpdateAuthIdentityDTO }> = []

    setupWorkflowEngine({
      retrieveAuthIdentity: async () => identity,
      updateAuthIdentity: async (id, data) => {
        updateCalls.push({ id, data })
        return dto.generate.authIdentity({ appMetadata: data.appMetadata ?? null })
      },
    })

    await makeTestWorkflow({ authIdentityId: 'authid_test1', actorType: 'user', actorId: 'usr_abc' })

    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]?.id).toEqual('authid_test1')
    expect(updateCalls[0]?.data.appMetadata).toEqual({ userId: 'usr_abc' })
  })

  test('preserves existing app_metadata keys', async ({ dto, expect }) => {
    const identity = dto.generate.authIdentity({ appMetadata: { registered: true } })
    const updateCalls: Array<{ id: string; data: UpdateAuthIdentityDTO }> = []

    setupWorkflowEngine({
      retrieveAuthIdentity: async () => identity,
      updateAuthIdentity: async (id, data) => {
        updateCalls.push({ id, data })
        return dto.generate.authIdentity({ appMetadata: data.appMetadata ?? null })
      },
    })

    await makeTestWorkflow({ authIdentityId: 'authid_test1', actorType: 'user', actorId: 'usr_abc' })

    expect(updateCalls[0]?.data.appMetadata).toEqual({ registered: true, userId: 'usr_abc' })
  })

  test('throws on overwrite attempt', async ({ dto, expect }) => {
    const identity = dto.generate.authIdentity({ appMetadata: { userId: 'usr_existing' } })

    setupWorkflowEngine({
      retrieveAuthIdentity: async () => identity,
      updateAuthIdentity: vi.fn(),
    })

    await expect(
      makeTestWorkflow({ authIdentityId: 'authid_test1', actorType: 'user', actorId: 'usr_new' }),
    ).rejects.toThrow(WorkflowTerminalError)

    await expect(
      makeTestWorkflow({ authIdentityId: 'authid_test1', actorType: 'user', actorId: 'usr_new' }),
    ).rejects.toThrow('already has "userId" set')
  })

  test('allows clearing an existing link with null', async ({ dto, expect }) => {
    const identity = dto.generate.authIdentity({ appMetadata: { userId: 'usr_existing' } })
    const updateCalls: Array<{ id: string; data: UpdateAuthIdentityDTO }> = []

    setupWorkflowEngine({
      retrieveAuthIdentity: async () => identity,
      updateAuthIdentity: async (id, data) => {
        updateCalls.push({ id, data })
        return dto.generate.authIdentity({ appMetadata: data.appMetadata ?? null })
      },
    })

    await makeTestWorkflow({ authIdentityId: 'authid_test1', actorType: 'user', actorId: null })

    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]?.data.appMetadata).toEqual({ userId: null })
  })

  test('compensation restores previous app_metadata on rollback', async ({ dto, expect }) => {
    const identity = dto.generate.authIdentity({ appMetadata: { registered: true } })
    const updateCalls: Array<{ id: string; data: UpdateAuthIdentityDTO }> = []

    setupWorkflowEngine({
      retrieveAuthIdentity: async () => identity,
      updateAuthIdentity: async (id, data) => {
        updateCalls.push({ id, data })
        return dto.generate.authIdentity({ appMetadata: data.appMetadata ?? null })
      },
    })

    const failingWorkflow = createWorkflow<SetAuthAppMetadataInput, void>('test-compensation', async (ctx, input) => {
      await setAuthAppMetadataStep(ctx, input)
      await ctx.step('deliberate-failure', async () => {
        throw new Error('deliberate failure')
      })
    })

    await expect(
      failingWorkflow.run({ authIdentityId: 'authid_test1', actorType: 'user', actorId: 'usr_abc' }),
    ).rejects.toThrow('deliberate failure')

    // First call: the step writing userId
    // Second call: compensation restoring previous metadata
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0]?.data.appMetadata).toEqual({ registered: true, userId: 'usr_abc' })
    expect(updateCalls[1]?.data.appMetadata).toEqual({ registered: true })
  })

  test('compensation restores null when app_metadata was originally null', async ({ dto, expect }) => {
    const identity = dto.generate.authIdentity({ appMetadata: null })
    const updateCalls: Array<{ id: string; data: UpdateAuthIdentityDTO }> = []

    setupWorkflowEngine({
      retrieveAuthIdentity: async () => identity,
      updateAuthIdentity: async (id, data) => {
        updateCalls.push({ id, data })
        return dto.generate.authIdentity({ appMetadata: data.appMetadata ?? null })
      },
    })

    const failingWorkflow = createWorkflow<SetAuthAppMetadataInput, void>(
      'test-compensation-null',
      async (ctx, input) => {
        await setAuthAppMetadataStep(ctx, input)
        await ctx.step('deliberate-failure', async () => {
          throw new Error('deliberate failure')
        })
      },
    )

    await expect(
      failingWorkflow.run({ authIdentityId: 'authid_test1', actorType: 'user', actorId: 'usr_abc' }),
    ).rejects.toThrow('deliberate failure')

    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[1]?.data.appMetadata).toBeNull()
  })

  test('produces a JWT with actorId after the step sets app_metadata', async ({ dto, expect }) => {
    let storedMetadata: Record<string, unknown> | null = null
    const identity = dto.generate.authIdentity()

    setupWorkflowEngine({
      retrieveAuthIdentity: async () => identity,
      updateAuthIdentity: async (_id, data) => {
        storedMetadata = (data.appMetadata as Record<string, unknown>) ?? null
        return dto.generate.authIdentity({ appMetadata: storedMetadata })
      },
    })

    await makeTestWorkflow({ authIdentityId: 'authid_test1', actorType: 'user', actorId: 'usr_linked' })

    // Simulate token refresh: generate JWT from the updated identity
    const token = generateJwtTokenForAuthIdentity(
      {
        authIdentity: { ...identity, appMetadata: storedMetadata },
        actorType: 'user',
        authProvider: 'emailpass',
      },
      { secret: JWT_SECRET, expiresIn: '1d' },
    )

    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('usr_linked')
    expect(decoded.actorType).toBe('user')
  })
})
