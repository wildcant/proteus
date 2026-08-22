import { test } from '@tests/setup/test-extend.js'
import { ErrorTypes } from '../../errors/app-error.js'
import { validateScopeProviderAssociation } from '../utils/validate-scope-provider-association.js'

test.describe('validateScopeProviderAssociation', () => {
  const middleware = validateScopeProviderAssociation()

  test('allows configured provider for actor type', async ({ makeRequest, expect }) => {
    const result = await middleware(makeRequest({ params: { actorType: 'user', authProvider: 'emailpass' } }))
    expect(result.params.actorType).toBe('user')
  })

  test('rejects unconfigured provider for actor type', async ({ makeRequest, expect }) => {
    await expect(
      middleware(makeRequest({ params: { actorType: 'user', authProvider: 'google' } })),
    ).rejects.toMatchObject({
      type: ErrorTypes.NOT_ALLOWED,
    })
  })

  test('rejects unknown actor type', async ({ makeRequest, expect }) => {
    await expect(
      middleware(makeRequest({ params: { actorType: 'unknown_type', authProvider: 'anything' } })),
    ).rejects.toMatchObject({
      type: ErrorTypes.NOT_ALLOWED,
    })
  })
})
