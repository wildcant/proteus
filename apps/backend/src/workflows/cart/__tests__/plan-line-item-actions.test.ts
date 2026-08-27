import { BigNumber } from '@core/db/bignum.js'
import type { CreateLineItemDTO } from '@core/types/cart/mutations.js'
import { test } from '@tests/setup/test-extend.js'
import { type MergeableLineItem, planLineItemActions } from '../utils/plan-line-item-actions.js'

const existingLine = (overrides: Partial<MergeableLineItem> = {}): MergeableLineItem => ({
  id: 'cali_existing',
  variantId: 'variant_a',
  quantity: 1,
  unitPrice: new BigNumber('10'),
  ...overrides,
})

const addition = (overrides: Partial<CreateLineItemDTO> = {}): CreateLineItemDTO => ({
  title: 'Tee',
  variantId: 'variant_a',
  quantity: 1,
  unitPrice: new BigNumber('10'),
  ...overrides,
})

test.describe('planLineItemActions', () => {
  test('starts a line for a variant the cart does not hold', ({ expect }) => {
    const plan = planLineItemActions([existingLine({ variantId: 'variant_b' })], [addition({ quantity: 2 })])

    expect(plan.merge).toEqual([])
    expect(plan.create).toMatchObject([{ variantId: 'variant_a', quantity: 2 }])
  })

  test('adds to the line the cart already holds instead of starting a second', ({ expect }) => {
    const plan = planLineItemActions([existingLine({ quantity: 3 })], [addition({ quantity: 2 })])

    expect(plan.create).toEqual([])
    expect(plan.merge).toMatchObject([{ id: 'cali_existing', variantId: 'variant_a', data: { quantity: 5 } }])
  })

  test('reprices the merged line to the incoming price', ({ expect }) => {
    const plan = planLineItemActions(
      [existingLine({ unitPrice: new BigNumber('10') })],
      [addition({ unitPrice: new BigNumber('12') })],
    )

    // The whole line sells at the price the catalogue is quoting now, not at the one the row
    // was written with.
    expect(plan.merge[0]?.data.unitPrice?.toString()).toBe('12')
  })

  test('folds repeats of one variant within a single addition', ({ expect }) => {
    const plan = planLineItemActions([], [addition({ quantity: 1 }), addition({ quantity: 2 })])

    expect(plan.merge).toEqual([])
    expect(plan.create).toMatchObject([{ variantId: 'variant_a', quantity: 3 }])
  })

  test('folds repeats into the existing line exactly once', ({ expect }) => {
    const plan = planLineItemActions(
      [existingLine({ quantity: 1 })],
      [addition({ quantity: 2 }), addition({ quantity: 4 })],
    )

    expect(plan.create).toEqual([])
    expect(plan.merge).toMatchObject([{ id: 'cali_existing', data: { quantity: 7 } }])
  })

  test('keeps different variants apart', ({ expect }) => {
    const plan = planLineItemActions(
      [existingLine({ variantId: 'variant_a' })],
      [addition({ variantId: 'variant_a' }), addition({ variantId: 'variant_b' })],
    )

    expect(plan.merge).toMatchObject([{ id: 'cali_existing', variantId: 'variant_a' }])
    expect(plan.create).toMatchObject([{ variantId: 'variant_b', quantity: 1 }])
  })

  test('never merges a line with no variant to match on', ({ expect }) => {
    const plan = planLineItemActions([existingLine({ variantId: null })], [addition({ variantId: undefined })])

    expect(plan.merge).toEqual([])
    expect(plan.create).toHaveLength(1)
  })

  test('leaves the caller’s items untouched', ({ expect }) => {
    const item = addition({ quantity: 1 })

    planLineItemActions([], [item, addition({ quantity: 5 })])

    // The accumulated quantity goes onto the plan's own copy. Mutating the input would have the
    // workflow's `lineItems` disagree with what it wrote.
    expect(item.quantity).toBe(1)
  })
})
