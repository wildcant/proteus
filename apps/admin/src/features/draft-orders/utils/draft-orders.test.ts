import { describe, expect, it } from 'vitest'
import type { AdminOrderShippingMethod } from '#/api/generated/model'
import {
  convertDraftDefaults,
  convertDraftPayload,
  convertDraftSchema,
} from '#/features/draft-orders/utils/convert-draft'
import { draftActions } from '#/features/draft-orders/utils/draft-actions'
import {
  draftContactDefaults,
  draftContactPayload,
  draftContactSchema,
} from '#/features/draft-orders/utils/draft-contact'
import {
  draftShippingDefaults,
  draftShippingPayload,
  draftShippingSchema,
} from '#/features/draft-orders/utils/draft-shipping'

const draft = {
  currencyCode: 'usd',
  totals: {
    itemsTotal: '1000',
    shippingTotal: '234.56',
    orderTotal: '1234.56',
    paidTotal: '0',
    outstandingTotal: '1234.56',
  },
}

describe('converting a draft', () => {
  it("opens on the store's deposit share, rounded, with the payment on", () => {
    expect(convertDraftDefaults(draft, 30)).toEqual({ recordPayment: true, amount: '370.37' })
  })

  it('opens unpaid when the store takes no deposit, with the full total ready', () => {
    expect(convertDraftDefaults(draft, undefined)).toEqual({ recordPayment: false, amount: '1234.56' })
  })

  it('sends the payment only when it is on, and nothing at all otherwise', () => {
    expect(convertDraftPayload({ recordPayment: true, amount: ' 370.37 ' })).toEqual({ paymentAmount: '370.37' })
    expect(convertDraftPayload({ recordPayment: false, amount: '370.37' })).toBeUndefined()
  })

  it('refuses a payment of nothing or above the total, and ignores the amount when converting unpaid', () => {
    const schema = convertDraftSchema('1234.56')
    expect(schema.safeParse({ recordPayment: true, amount: '1234.56' }).success).toBe(true)

    const over = schema.safeParse({ recordPayment: true, amount: '1234.57' })
    expect(over.error?.issues.map((issue) => issue.path)).toEqual([['amount']])
    expect(schema.safeParse({ recordPayment: true, amount: '0' }).success).toBe(false)
    expect(schema.safeParse({ recordPayment: false, amount: '' }).success).toBe(true)
  })
})

describe('what the admin may do to a draft', () => {
  const everything = ['order.edit', 'order.complete', 'order.cancel']

  it('edits, converts, cancels and deletes an open draft, each behind its own permission', () => {
    expect(draftActions('draft', everything)).toEqual({
      canEdit: true,
      canConvert: true,
      canCancel: true,
      canDelete: true,
    })
    expect(draftActions('draft', ['order.read', 'order.complete'])).toEqual({
      canEdit: false,
      canConvert: true,
      canCancel: false,
      canDelete: false,
    })
  })

  it('leaves only delete on a canceled draft', () => {
    expect(draftActions('canceled', everything)).toEqual({
      canEdit: false,
      canConvert: false,
      canCancel: false,
      canDelete: true,
    })
  })
})

describe("a draft's contact and address", () => {
  it('opens empty fields for what the shopper never gave, and sends them back as cleared', () => {
    const values = draftContactDefaults({ email: null, shippingAddress: null })
    expect(values.email).toBe('')
    expect(values.phone).toBe('')

    const payload = draftContactPayload({ ...values, phone: ' +57 300 123 4567 ', countryCode: 'CO' })
    expect(payload.email).toBeNull()
    expect(payload.shippingAddress).toMatchObject({ phone: '+57 300 123 4567', countryCode: 'co', city: null })
  })

  it('accepts no email, and refuses a malformed one', () => {
    const values = draftContactDefaults({ email: null, shippingAddress: null })
    expect(draftContactSchema.safeParse(values).success).toBe(true)
    expect(draftContactSchema.safeParse({ ...values, email: 'shopper@example.com' }).success).toBe(true)
    expect(draftContactSchema.safeParse({ ...values, email: 'not-an-email' }).success).toBe(false)
  })
})

describe("a draft's shipping method", () => {
  const method: AdminOrderShippingMethod = {
    id: 'osm_1',
    orderId: 'order_1',
    name: 'Courier',
    description: null,
    amount: '12.50',
    shippingOptionId: 'so_1',
    data: null,
    isCustomAmount: true,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  }

  it('opens on the current option, with the custom amount only when the shop set one', () => {
    expect(draftShippingDefaults({ shippingMethods: [method] })).toEqual({
      shippingOption: { id: 'so_1', label: 'Courier' },
      customAmount: '12.50',
    })
    expect(draftShippingDefaults({ shippingMethods: [{ ...method, isCustomAmount: false }] }).customAmount).toBe('')
    expect(draftShippingDefaults({ shippingMethods: [] }).shippingOption).toBeNull()
  })

  it('leaves the price to the option when no custom amount is given', () => {
    const option = { id: 'so_1', label: 'Courier' }
    expect(draftShippingPayload({ shippingOption: option, customAmount: '' })).toEqual({ shippingOptionId: 'so_1' })
    expect(draftShippingPayload({ shippingOption: option, customAmount: '0' })).toEqual({
      shippingOptionId: 'so_1',
      customAmount: '0',
    })
  })

  it('requires an option and refuses a negative amount', () => {
    const option = { id: 'so_1', label: 'Courier' }
    expect(draftShippingSchema.safeParse({ shippingOption: option, customAmount: '' }).success).toBe(true)
    expect(draftShippingSchema.safeParse({ shippingOption: null, customAmount: '' }).success).toBe(false)
    expect(draftShippingSchema.safeParse({ shippingOption: option, customAmount: '-1' }).success).toBe(false)
  })
})
