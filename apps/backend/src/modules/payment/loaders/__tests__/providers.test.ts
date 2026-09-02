import { asValue, createContainer } from 'awilix'
import { describe, expect, test } from 'vitest'
import { noopLogger } from '../../../../framework/logger/noop-logger.js'
import stripeProvider from '../../../../providers/payment-stripe/index.js'
import { loadProviders, type ProviderConfig } from '../providers.js'

/**
 * The loader's own dependencies, stubbed. Nothing here touches a database: the point is what
 * happens *before* a provider is constructed, and a misconfigured one never gets that far.
 */
function loaderContainer() {
  const container = createContainer()
  container.register({
    logger: asValue(noopLogger),
    paymentProviderRepository: asValue({
      findById: async () => null,
      create: async () => undefined,
      update: async () => undefined,
    }),
  })
  return container
}

const stripeConfigured = (options: Record<string, unknown>): ProviderConfig => ({
  resolve: stripeProvider,
  id: 'default',
  options,
})

const complete = { apiKey: 'sk_test_x', webhookSecret: 'whsec_x' }

describe('loadProviders', () => {
  test('registers a fully configured provider', async () => {
    const container = loaderContainer()

    await loadProviders({ container, options: { providers: [stripeConfigured(complete)] } })

    expect(container.resolve('pp_stripe_default')).toBeDefined()
  })

  test.each([['apiKey'], ['webhookSecret']])('refuses to start when "%s" is missing', async (missing) => {
    const options: Record<string, unknown> = { ...complete }
    delete options[missing]
    const container = loaderContainer()

    // Names the provider and the option, because the operator reading this line is looking at a
    // deploy log and has nothing else to go on.
    await expect(loadProviders({ container, options: { providers: [stripeConfigured(options)] } })).rejects.toThrow(
      new RegExp(`"stripe".+"${missing}"`),
    )
  })

  test('refuses to start on a malformed credential, not only a missing one', async () => {
    const container = loaderContainer()

    await expect(
      loadProviders({ container, options: { providers: [stripeConfigured({ ...complete, apiKey: '   ' })] } }),
    ).rejects.toThrow(/"apiKey"/)
  })

  test('leaves nothing registered, so the failure cannot be deferred to the first payment', async () => {
    const container = loaderContainer()

    // Blank rather than absent, deliberately. `new Stripe(undefined)` throws on its own, so a
    // *missing* key would leave nothing registered even with the loader's validation removed —
    // and the test would pass for a reason that has nothing to do with what it is checking.
    // `new Stripe('   ')` succeeds, so only the loader's own check can stop this one.
    await loadProviders({
      container,
      options: { providers: [stripeConfigured({ ...complete, apiKey: '   ' })] },
    }).catch(() => undefined)

    // The failure mode this replaces: a provider that registers happily on a blank key and
    // reports it as a declined card, in front of a shopper, hours after the deploy.
    expect(() => container.resolve('pp_stripe_default')).toThrow()
  })
})
