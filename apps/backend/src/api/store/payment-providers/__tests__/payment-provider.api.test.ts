import type { StorePaymentProviderListResponse } from '@proteus/http-schemas/store'
import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { expect } from 'vitest'
import { env } from '../../../../env.js'
import paymentProviderDefinitions from '../definitions.js'

/** The DI keys the two configured providers are registered under. */
const STRIPE_PROVIDER = 'pp_stripe_default'
const SYSTEM_PROVIDER = 'pp_system_default'

/**
 * What each provider is allowed to publish, by name.
 *
 * This is the assertion the spec asks for: not "no secret is present" — which passes for as long
 * as nobody adds one — but "these keys and no others". An implementation that spread
 * `StripeOptions` would answer with `apiKey` and `webhookSecret` here and fail on the key set
 * before anyone had to think of the secret's name.
 */
const ALLOWED_PUBLIC_CONFIG_KEYS: Record<string, string[]> = {
  [STRIPE_PROVIDER]: ['publishableKey'],
  [SYSTEM_PROVIDER]: [],
}

/**
 * Every option name the Stripe adapter is configured with that must never leave the server, and
 * the configured value behind it — a search for the name alone would pass against a response that
 * carried the secret under some other key.
 */
const STRIPE_SECRET_OPTIONS = {
  apiKey: env.STRIPE_SECRET_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
}

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: paymentProviderDefinitions })
})

const listProviders = () => api.get<StorePaymentProviderListResponse>('/store/payment-providers')

test('serves each provider only the keys that provider is allowed to publish', async () => {
  const { status, body } = await listProviders()

  expect(status).toBe(200)
  for (const [providerId, allowedKeys] of Object.entries(ALLOWED_PUBLIC_CONFIG_KEYS)) {
    const provider = body.paymentProviders.find((candidate) => candidate.id === providerId)
    expect(provider, `no provider "${providerId}" in the response`).toBeDefined()
    expect(Object.keys(provider?.publicConfig ?? {}).sort()).toEqual([...allowedKeys].sort())
  }
})

test('serves the publishable key the storefront boots Stripe.js with', async () => {
  const { body } = await listProviders()

  const stripe = body.paymentProviders.find((provider) => provider.id === STRIPE_PROVIDER)
  expect(stripe?.publicConfig.publishableKey).toBe(env.STRIPE_PUBLISHABLE_KEY)
  expect(stripe?.publicConfig.publishableKey).toEqual(expect.stringMatching(/^pk_/))
})

test('never serves a secret option, whatever the response is searched for it in', async () => {
  const { body } = await listProviders()

  // The whole body, not just publicConfig: a secret arriving through some other field the route
  // grew later is the same leak.
  const serialized = JSON.stringify(body)
  for (const [option, value] of Object.entries(STRIPE_SECRET_OPTIONS)) {
    expect(value, `${option} is not configured, so this test proves nothing`).toBeTruthy()
    expect(serialized).not.toContain(value)
    expect(serialized).not.toContain(option)
  }
})

test('gives a provider with nothing publishable an empty object rather than omitting the field', async () => {
  const { body } = await listProviders()

  // A missing field and an empty one read the same in JavaScript and differently in a schema. The
  // storefront's registry branches on whether an adapter exists, not on whether config arrived, so
  // the field is always present — and the system provider is the case that proves it.
  const system = body.paymentProviders.find((provider) => provider.id === SYSTEM_PROVIDER)
  expect(system?.publicConfig).toEqual({})
})
