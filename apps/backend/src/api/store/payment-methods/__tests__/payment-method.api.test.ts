import type { DeleteResponse, StoreSavedMethodListResponse } from '@proteus/http-schemas/store'
import { stripeGateway } from '@tests/mocks/stripe.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import { vi } from 'vitest'
import paymentMethodDefinitions from '../definitions.js'

vi.mock('stripe', async () => (await import('@tests/mocks/stripe.js')).stripeModuleMock())

/**
 * The wallet, at the seam a storefront sees it through.
 *
 * The criterion that matters most here is ownership, and it is the one easiest to fake: every
 * assertion about it uses two real customers and goes through the real routes, because a stubbed
 * authorization check would pass whatever the adapter did.
 */

let api: TestApi

// The real `authenticate` middleware, because half this file is about what an authenticated
// caller still may not do — and that is not observable without it.
test.beforeEach(async ({ createApi }) => {
  stripeGateway.reset()
  api = await createApi({ definitions: paymentMethodDefinitions, namespaceAuth: true })
})

const list = (headers?: Record<string, string>) =>
  api.get<StoreSavedMethodListResponse | ApiErrorBody>('/store/payment-methods', undefined, { headers })

const remove = (methodId: string, headers?: Record<string, string>) =>
  api.delete<DeleteResponse | ApiErrorBody>(`/store/payment-methods/${methodId}`, undefined, { headers })

const makeDefault = (methodId: string, headers?: Record<string, string>) =>
  api.post<StoreSavedMethodListResponse | ApiErrorBody>(`/store/payment-methods/${methodId}/default`, undefined, {
    headers,
  })

/**
 * A shopper with an account and a wallet the gateway already holds.
 *
 * The account holder is created by the first wallet read, exactly as it is in production — which
 * is also what gives the test the gateway-side customer id to hang cards off.
 */
async function shopperWithWallet(service: Fixtures['service'], cards: number) {
  const customer = await service.create.customer(api.container, { hasAccount: true })
  const headers = authHeader('customer', customer.id)

  await list(headers)
  const gatewayCustomer = stripeGateway.customerFor(customer.id)
  if (!gatewayCustomer) throw new Error('No Stripe Customer was created for an authenticated shopper')

  const methods = Array.from({ length: cards }, (_, index) =>
    stripeGateway.storeMethod(gatewayCustomer.id, {
      created: 1_700_000_000 + index,
      card: { last4: String(1000 + index) },
    }),
  )

  return { customer, headers, gatewayCustomer, methods }
}

const idsOf = (body: StoreSavedMethodListResponse | ApiErrorBody) =>
  'paymentMethods' in body ? body.paymentMethods.map((method) => method.id) : []

test.describe('GET /store/payment-methods', () => {
  test('refuses a guest', async ({ expect }) => {
    const { status, body } = await list()

    expect(status).toBe(401)
    expect(body).toMatchObject({ type: 'unauthorized' })
  })

  test('creates one Account Holder on the first read and reuses it on the next', async ({ service, expect }) => {
    const customer = await service.create.customer(api.container, { hasAccount: true })
    const headers = authHeader('customer', customer.id)

    const first = await list(headers)
    const second = await list(headers)

    expect(first.status).toBe(200)
    expect(idsOf(second.body)).toEqual([])
    // One Customer at the gateway across two checkouts, not one per read.
    expect(stripeGateway.callsTo('customers.create')).toHaveLength(1)
    expect(stripeGateway.customers.size).toBe(1)
  })

  test('creates nothing at the gateway for a customer row that is not an account', async ({ service, expect }) => {
    // Proteus writes one of these for every guest checkout. Gating on "has a Customer record"
    // rather than on `hasAccount` would give every guest a Stripe Customer.
    const guest = await service.create.customer(api.container, { hasAccount: false })

    const { status, body } = await list(authHeader('customer', guest.id))

    expect(status).toBe(200)
    expect(idsOf(body)).toEqual([])
    expect(stripeGateway.customers.size).toBe(0)
  })

  test('projects to the neutral shape and never the gateway object', async ({ service, expect }) => {
    const { headers, methods } = await shopperWithWallet(service, 1)
    const [card] = methods
    if (!card) throw new Error('no card')

    const { status, body } = await list(headers)

    expect(status).toBe(200)
    expect('paymentMethods' in body ? body.paymentMethods[0] : undefined).toEqual({
      id: card.id,
      brand: 'visa',
      last4: '1000',
      expMonth: 12,
      expYear: 2030,
      isDefault: false,
    })
    // Named individually because the point is the *absence* of the gateway's vocabulary. Two
    // things have to fail for one to arrive: the projection would have to carry it (pinned by
    // `payment-stripe/__tests__/saved-methods.test.ts`) *and* the response schema would have to
    // stop stripping it. This is the assertion that catches the second half.
    const serialised = JSON.stringify(body)
    for (const gatewayField of ['allow_redisplay', '"card"', '"object"', 'exp_month', 'created']) {
      expect(serialised).not.toContain(gatewayField)
    }
  })

  test('lists only methods the shopper consented to redisplay', async ({ service, expect }) => {
    const { headers, gatewayCustomer, methods } = await shopperWithWallet(service, 1)
    const consented = methods[0]
    // Attached to the customer but never consented to — which is what `setup_future_usage` alone
    // leaves behind. Listing it would show a shopper a card they never agreed to keep.
    const unconsented = stripeGateway.storeMethod(gatewayCustomer.id, {
      // biome-ignore lint/style/useNamingConvention: the Stripe field under test
      allow_redisplay: 'unspecified',
    })

    const { body } = await list(headers)

    expect(idsOf(body)).toEqual([consented?.id])
    expect(idsOf(body)).not.toContain(unconsented.id)
  })

  test('orders the default first and then the most recent', async ({ service, expect }) => {
    const { headers, methods } = await shopperWithWallet(service, 3)
    const [oldest, middle, newest] = methods
    if (!oldest || !middle || !newest) throw new Error('no cards')
    await makeDefault(oldest.id, headers)

    const { body } = await list(headers)

    // The default leads despite being the oldest; the rest fall in most-recent-first order.
    expect(idsOf(body)).toEqual([oldest.id, newest.id, middle.id])
  })

  test("returns only the requesting customer's methods", async ({ service, expect }) => {
    const mine = await shopperWithWallet(service, 1)
    const theirs = await shopperWithWallet(service, 1)

    const { body } = await list(mine.headers)

    expect(idsOf(body)).toEqual([mine.methods[0]?.id])
    expect(idsOf(body)).not.toContain(theirs.methods[0]?.id)
  })
})

test.describe('DELETE /store/payment-methods/:id', () => {
  test('refuses a guest', async ({ expect }) => {
    const { status } = await remove('pm_anything')

    expect(status).toBe(401)
  })

  test("detaches the shopper's own method", async ({ service, expect }) => {
    const { headers, methods } = await shopperWithWallet(service, 1)
    const card = methods[0]
    if (!card) throw new Error('no card')

    const { status } = await remove(card.id, headers)

    expect(status).toBe(200)
    expect(stripeGateway.methods.get(card.id)?.customer).toBeNull()
    expect(idsOf((await list(headers)).body)).toEqual([])
  })

  test("will not detach another customer's method", async ({ service, expect }) => {
    const attacker = await shopperWithWallet(service, 0)
    const victim = await shopperWithWallet(service, 1)
    const victimCard = victim.methods[0]
    if (!victimCard) throw new Error('no card')

    const { status, body } = await remove(victimCard.id, attacker.headers)

    expect(status).toBe(409)
    expect(body).toMatchObject({ type: 'conflict', code: 'payment_method_unavailable' })
    // Still the victim's, and still in their wallet.
    expect(stripeGateway.methods.get(victimCard.id)?.customer).toBe(victim.gatewayCustomer.id)
    expect(idsOf((await list(victim.headers)).body)).toEqual([victimCard.id])
  })

  test('answers a stale id with a conflict carrying no gateway wording', async ({ service, expect }) => {
    const { headers } = await shopperWithWallet(service, 0)

    const { status, body } = await remove('pm_long_gone', headers)

    expect(status).toBe(409)
    expect(body).toMatchObject({ code: 'payment_method_unavailable' })
    // Stripe would have said `No such PaymentMethod: 'pm_long_gone'`, which both confirms an id
    // to anyone probing and reads as our copy.
    const message = 'message' in body ? body.message : ''
    expect(message).not.toContain('pm_long_gone')
    expect(message).not.toContain('No such')
  })
})

test.describe('POST /store/payment-methods/:id/default', () => {
  test('refuses a guest', async ({ expect }) => {
    const { status } = await makeDefault('pm_anything')

    expect(status).toBe(401)
  })

  test('writes the default on the gateway customer, and adds no Proteus row for it', async ({ service, expect }) => {
    const { headers, gatewayCustomer, methods } = await shopperWithWallet(service, 2)
    const chosen = methods[1]
    if (!chosen) throw new Error('no card')

    const { status, body } = await makeDefault(chosen.id, headers)

    expect(status).toBe(200)
    expect(stripeGateway.customers.get(gatewayCustomer.id)?.invoice_settings.default_payment_method).toBe(chosen.id)
    // The wallet comes back already reordered, so the client does not render a stale order while
    // it refetches its own answer.
    expect(idsOf(body)[0]).toBe(chosen.id)
  })

  test("will not nominate another customer's method", async ({ service, expect }) => {
    const attacker = await shopperWithWallet(service, 0)
    const victim = await shopperWithWallet(service, 1)
    const victimCard = victim.methods[0]
    if (!victimCard) throw new Error('no card')

    const { status, body } = await makeDefault(victimCard.id, attacker.headers)

    expect(status).toBe(409)
    expect(body).toMatchObject({ code: 'payment_method_unavailable' })
    expect(stripeGateway.customers.get(attacker.gatewayCustomer.id)?.invoice_settings.default_payment_method).toBeNull()
    expect(stripeGateway.customers.get(victim.gatewayCustomer.id)?.invoice_settings.default_payment_method).toBeNull()
  })
})
