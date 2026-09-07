import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import paymentProviderDefinitions from '../definitions.js'
import type * as paymentProviderRoutes from '../route.js'

/** Registered and seeded by the payment module's loader when the container boots. */
const MANUAL_PROVIDER_ID = 'pp_system_default'
const STRIPE_PROVIDER_ID = 'pp_stripe_default'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: paymentProviderDefinitions })
})

test.describe('GET /admin/payment-providers', () => {
  test('lists the gateways a region may be given', async ({ expect }) => {
    const { status, body } = await api.get<typeof paymentProviderRoutes.GetOutput>('/admin/payment-providers')

    expect(status).toBe(200)
    expect(body.paymentProviders).toEqual([
      { id: STRIPE_PROVIDER_ID, isEnabled: true },
      { id: MANUAL_PROVIDER_ID, isEnabled: true },
    ])
  })

  test('omits a disabled provider, so the region editor cannot offer one that would fail', async ({
    expect,
    factories,
  }) => {
    await factories.update.paymentProviderEnabled(STRIPE_PROVIDER_ID, false)

    const { body } = await api.get<typeof paymentProviderRoutes.GetOutput>('/admin/payment-providers')

    expect(body.paymentProviders.map((provider) => provider.id)).toEqual([MANUAL_PROVIDER_ID])
  })

  test('refuses a request carrying no credential', async ({ expect, createApi }) => {
    const authed = await createApi({ definitions: paymentProviderDefinitions, namespaceAuth: true })

    const anonymous = await authed.get<ApiErrorBody>('/admin/payment-providers')
    const staff = await authed.get<typeof paymentProviderRoutes.GetOutput>('/admin/payment-providers', undefined, {
      headers: authHeader('user', 'user_admin'),
    })

    expect(anonymous.status).toBe(401)
    expect(staff.status).toBe(200)
  })
})
