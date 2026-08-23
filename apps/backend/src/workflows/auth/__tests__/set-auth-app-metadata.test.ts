import { generateJwtTokenForAuthIdentity } from '@core/auth/utils/generate-jwt-token.js'
import { WorkflowTerminalError } from '@core/workflows/types.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import jwt from 'jsonwebtoken'
import { setAuthAppMetadataStep } from '../steps/set-auth-app-metadata.js'

const JWT_SECRET = 'test-secret-for-unit-tests'

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test.describe('setAuthAppMetadataStep', () => {
  test('writes actorId under the actor type key', async ({ service, step, expect }) => {
    const identity = await service.create.authIdentity(container)

    await step.run(setAuthAppMetadataStep, {
      authIdentityId: identity.id,
      actorType: 'user',
      actorId: 'usr_abc',
    })

    const updated = await service.read.authIdentity(container, identity.id)
    expect(updated.appMetadata).toEqual({ userId: 'usr_abc' })
  })

  test('preserves the keys it does not own', async ({ service, step, expect }) => {
    const identity = await service.create.authIdentity(container, { appMetadata: { registered: true } })

    await step.run(setAuthAppMetadataStep, {
      authIdentityId: identity.id,
      actorType: 'user',
      actorId: 'usr_abc',
    })

    const updated = await service.read.authIdentity(container, identity.id)
    expect(updated.appMetadata).toEqual({ registered: true, userId: 'usr_abc' })
  })

  test('refuses to overwrite an actor that is already linked', async ({ service, step, expect }) => {
    const identity = await service.create.authIdentity(container, { appMetadata: { userId: 'usr_existing' } })

    const run = () =>
      step.run(setAuthAppMetadataStep, { authIdentityId: identity.id, actorType: 'user', actorId: 'usr_new' })

    await expect(run()).rejects.toThrow(WorkflowTerminalError)
    await expect(run()).rejects.toThrow('already has "userId" set')

    const untouched = await service.read.authIdentity(container, identity.id)
    expect(untouched.appMetadata).toEqual({ userId: 'usr_existing' })
  })

  test('allows clearing an existing link with null', async ({ service, step, expect }) => {
    const identity = await service.create.authIdentity(container, { appMetadata: { userId: 'usr_existing' } })

    await step.run(setAuthAppMetadataStep, {
      authIdentityId: identity.id,
      actorType: 'user',
      actorId: null,
    })

    const updated = await service.read.authIdentity(container, identity.id)
    expect(updated.appMetadata).toEqual({ userId: null })
  })

  test('rollback restores the previous metadata', async ({ service, step, expect }) => {
    const identity = await service.create.authIdentity(container, { appMetadata: { registered: true } })

    await step.runAndCompensate(setAuthAppMetadataStep, {
      authIdentityId: identity.id,
      actorType: 'user',
      actorId: 'usr_abc',
    })

    const restored = await service.read.authIdentity(container, identity.id)
    expect(restored.appMetadata).toEqual({ registered: true })
  })

  test('rollback restores null when there was no metadata', async ({ service, step, expect }) => {
    const identity = await service.create.authIdentity(container, { appMetadata: null })

    await step.runAndCompensate(setAuthAppMetadataStep, {
      authIdentityId: identity.id,
      actorType: 'user',
      actorId: 'usr_abc',
    })

    const restored = await service.read.authIdentity(container, identity.id)
    expect(restored.appMetadata).toBeNull()
  })

  test('the metadata it writes is what a refreshed JWT carries as actorId', async ({ service, step, expect }) => {
    const identity = await service.create.authIdentity(container)

    await step.run(setAuthAppMetadataStep, {
      authIdentityId: identity.id,
      actorType: 'user',
      actorId: 'usr_linked',
    })

    const token = generateJwtTokenForAuthIdentity(
      {
        authIdentity: await service.read.authIdentity(container, identity.id),
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
