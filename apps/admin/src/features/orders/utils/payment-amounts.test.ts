import { describe, expect, it } from 'vitest'
import {
  cancelOrderDefaults,
  cancelOrderSchema,
  recordPaymentPrefill,
  recordPaymentSchema,
  refundableAmount,
  refundPaymentSchema,
} from '#/features/orders/utils/payment-amounts'

const order = { orderTotal: '1234.56', outstandingTotal: '1234.56', currencyCode: 'usd' }

describe('recordPaymentPrefill', () => {
  it("opens the first payment on the store's deposit share, rounded to the currency's precision", () => {
    // 30 % of 1234.56 is 370.368: cents for dollars, whole units for yen.
    expect(recordPaymentPrefill({ ...order, isFirstPayment: true, depositPercentage: 30 })).toBe('370.37')
    expect(
      recordPaymentPrefill({
        orderTotal: '12345',
        outstandingTotal: '12345',
        currencyCode: 'jpy',
        isFirstPayment: true,
        depositPercentage: 30,
      }),
    ).toBe('3704')
  })

  it('opens on the outstanding amount, unrounded, once a payment exists or the store takes no deposit', () => {
    const afterDeposit = { ...order, outstandingTotal: '864.189' }
    expect(recordPaymentPrefill({ ...afterDeposit, isFirstPayment: false, depositPercentage: 30 })).toBe('864.189')
    expect(recordPaymentPrefill({ ...order, isFirstPayment: true, depositPercentage: undefined })).toBe('1234.56')
  })
})

describe('recordPaymentSchema', () => {
  const schema = recordPaymentSchema('100.50')

  it('submits an amount up to the outstanding, and refuses one above it or of nothing', () => {
    expect(schema.safeParse({ amount: '100.50' }).success).toBe(true)
    expect(schema.safeParse({ amount: '40' }).success).toBe(true)

    const over = schema.safeParse({ amount: '100.51' })
    expect(over.error?.issues.map((issue) => issue.path)).toEqual([['amount']])
    expect(schema.safeParse({ amount: '0' }).success).toBe(false)
  })
})

describe('refunds', () => {
  const payment = {
    captures: [
      { id: 'c1', paymentId: 'p', amount: '0.1', createdBy: null, metadata: null, createdAt: '' },
      { id: 'c2', paymentId: 'p', amount: '0.2', createdBy: null, metadata: null, createdAt: '' },
    ],
    refunds: [
      {
        id: 'r1',
        paymentId: 'p',
        amount: '0.05',
        refundReasonId: null,
        note: null,
        createdBy: null,
        metadata: null,
        createdAt: '',
      },
    ],
  }

  it('can give back what was captured less what was refunded, exactly', () => {
    expect(refundableAmount(payment)).toBe('0.25')
  })

  it('refuses a refund above the refundable', () => {
    const schema = refundPaymentSchema('0.25')
    expect(schema.safeParse({ amount: '0.25', note: '' }).success).toBe(true)
    expect(schema.safeParse({ amount: '0.26', note: '' }).success).toBe(false)
  })
})

describe('cancel with money received', () => {
  it('refunds everything received by default, and accepts anything from nothing to all of it', () => {
    expect(cancelOrderDefaults('300')).toEqual({ refundAmount: '300' })

    const schema = cancelOrderSchema('300')
    expect(schema.safeParse({ refundAmount: '0' }).success).toBe(true)
    expect(schema.safeParse({ refundAmount: '300' }).success).toBe(true)
    expect(schema.safeParse({ refundAmount: '300.01' }).success).toBe(false)
    expect(schema.safeParse({ refundAmount: '-1' }).success).toBe(false)
  })
})
