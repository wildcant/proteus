import type Stripe from 'stripe'
import { expect, test } from 'vitest'
import { defaultMethodIdOf, toSavedMethods } from '../saved-methods.js'

/**
 * The projection, on its own.
 *
 * A pure function rather than an architectural seam, so it is exercised directly: the cases that
 * matter here are shapes Stripe can return and a wallet has to survive, and reaching each of them
 * over HTTP would be indirection for its own sake.
 */

function paymentMethod(overrides: Partial<Stripe.PaymentMethod> = {}): Stripe.PaymentMethod {
  return {
    id: 'pm_1',
    object: 'payment_method',
    type: 'card',
    created: 1_700_000_000,
    livemode: false,
    customer: 'cus_1',
    // biome-ignore lint/style/useNamingConvention: the Stripe field under test
    allow_redisplay: 'always',
    // biome-ignore lint/style/useNamingConvention: the Stripe field under test
    billing_details: {} as Stripe.PaymentMethod.BillingDetails,
    metadata: {},
    card: {
      brand: 'visa',
      last4: '4242',
      // biome-ignore lint/style/useNamingConvention: the Stripe field under test
      exp_month: 4,
      // biome-ignore lint/style/useNamingConvention: the Stripe field under test
      exp_year: 2031,
    } as Stripe.PaymentMethod.Card,
    ...overrides,
  } as Stripe.PaymentMethod
}

const customer = (overrides: Partial<Stripe.Customer> = {}) =>
  ({
    id: 'cus_1',
    object: 'customer',
    // biome-ignore lint/style/useNamingConvention: the Stripe field under test
    invoice_settings: { default_payment_method: null },
    ...overrides,
  }) as Stripe.Customer

test('projects a card to the neutral shape and nothing else', () => {
  const [method] = toSavedMethods([paymentMethod()], null)

  expect(method).toEqual({
    id: 'pm_1',
    brand: 'visa',
    last4: '4242',
    expMonth: 4,
    expYear: 2031,
    isDefault: false,
    // Stripe counts seconds. Reading `created` as milliseconds dates every card to 1970, which
    // orders the whole wallet backwards.
    createdAt: new Date(1_700_000_000_000),
  })
})

test('marks the gateway default and only it', () => {
  const methods = toSavedMethods([paymentMethod(), paymentMethod({ id: 'pm_2' })], 'pm_2')

  expect(methods.map((method) => method.isDefault)).toEqual([false, true])
})

test('leaves out a saved method that is not a card', () => {
  // A stored bank debit has no brand and no last four; projecting one with empty strings puts an
  // unidentifiable row in front of a shopper choosing what to pay with.
  const methods = toSavedMethods([paymentMethod({ id: 'pm_bank', type: 'us_bank_account', card: undefined })], null)

  expect(methods).toEqual([])
})

/** A customer whose default is set, in the two shapes Stripe answers with. */
const withDefault = (chosen: string | Stripe.PaymentMethod) =>
  customer({
    // biome-ignore lint/style/useNamingConvention: the Stripe field under test
    invoice_settings: {
      // biome-ignore lint/style/useNamingConvention: the Stripe field under test
      default_payment_method: chosen,
    } as Stripe.Customer.InvoiceSettings,
  })

test('reads the default whether Stripe sent an id or the expanded object', () => {
  // Reading `.id` off the string form silently yields undefined, which marks nothing as default.
  expect(defaultMethodIdOf(withDefault('pm_7'))).toBe('pm_7')
  expect(defaultMethodIdOf(withDefault(paymentMethod({ id: 'pm_8' })))).toBe('pm_8')
})

test('a deleted customer has no default rather than an unreadable one', () => {
  expect(defaultMethodIdOf({ id: 'cus_1', object: 'customer', deleted: true } as Stripe.DeletedCustomer)).toBeNull()
})
