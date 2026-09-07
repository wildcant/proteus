import { test } from '@tests/setup/test-extend.js'
import type { CombinableOption } from '../utils/option-combinations.js'
import { planVariantReconciliation, type ReconcilableVariant } from '../utils/reconcile-variants.js'

const option = (id: string, title: string, values: Array<[string, string]>): CombinableOption => ({
  id,
  title,
  values: values.map(([valueId, value]) => ({ id: valueId, value })),
})

const SIZE_ID = 'opt_size'
const COLOR_ID = 'opt_color'
const SMALL = 'v_s'
const MEDIUM = 'v_m'
const WHITE = 'v_wht'
const BLACK = 'v_blk'

const SIZE = option(SIZE_ID, 'Size', [
  [SMALL, 'S'],
  [MEDIUM, 'M'],
])
const COLOR = option(COLOR_ID, 'Color', [
  [WHITE, 'White'],
  [BLACK, 'Black'],
])

let clock = 0
const variant = (id: string, title: string, optionValues: Record<string, string>): ReconcilableVariant => {
  clock += 1
  return { id, title, optionValues, createdAt: new Date(2026, 0, clock) }
}

test.describe('planVariantReconciliation — an option is added', () => {
  test('every existing variant is reassigned to the new option first value', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE],
      nextOptions: [SIZE, COLOR],
      variants: [variant('var_s', 'S', { [SIZE_ID]: SMALL }), variant('var_m', 'M', { [SIZE_ID]: MEDIUM })],
    })

    expect(plan.keep).toEqual([])
    expect(plan.reassign.map((entry) => [entry.variantId, entry.combination.label])).toEqual([
      ['var_s', 'S / White'],
      ['var_m', 'M / White'],
    ])
  })

  test('the rest of the matrix is created', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE],
      nextOptions: [SIZE, COLOR],
      variants: [variant('var_s', 'S', { [SIZE_ID]: SMALL }), variant('var_m', 'M', { [SIZE_ID]: MEDIUM })],
    })

    expect(plan.create.map((entry) => entry.combination.label)).toEqual(['S / Black', 'M / Black'])
    expect(plan.remove).toEqual([])
  })

  test('a created variant copies prices from the survivor it shares most values with', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE],
      nextOptions: [SIZE, COLOR],
      variants: [variant('var_s', 'S', { [SIZE_ID]: SMALL }), variant('var_m', 'M', { [SIZE_ID]: MEDIUM })],
    })

    // "M / Black" shares Size with the variant that became "M / White", not with the "S" one —
    // which is what lets a size added to a colour-priced product keep each colour's price.
    const black = plan.create.find((entry) => entry.combination.label === 'M / Black')
    expect(black?.copyPricesFromVariantId).toBe('var_m')
  })
})

test.describe('planVariantReconciliation — nothing changed', () => {
  test('plans no writes at all', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE, COLOR],
      nextOptions: [SIZE, COLOR],
      variants: [
        variant('var_1', 'S / White', { [SIZE_ID]: SMALL, [COLOR_ID]: WHITE }),
        variant('var_2', 'S / Black', { [SIZE_ID]: SMALL, [COLOR_ID]: BLACK }),
        variant('var_3', 'M / White', { [SIZE_ID]: MEDIUM, [COLOR_ID]: WHITE }),
        variant('var_4', 'M / Black', { [SIZE_ID]: MEDIUM, [COLOR_ID]: BLACK }),
      ],
    })

    expect(plan.keep.map((entry) => entry.variantId)).toEqual(['var_1', 'var_2', 'var_3', 'var_4'])
    expect(plan.reassign).toEqual([])
    expect(plan.create).toEqual([])
    expect(plan.remove).toEqual([])
  })

  test('a partial matrix is filled in rather than left alone', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE, COLOR],
      nextOptions: [SIZE, COLOR],
      variants: [variant('var_1', 'S / White', { [SIZE_ID]: SMALL, [COLOR_ID]: WHITE })],
    })

    expect(plan.keep.map((entry) => entry.variantId)).toEqual(['var_1'])
    expect(plan.create.map((entry) => entry.combination.label)).toEqual(['S / Black', 'M / White', 'M / Black'])
  })
})

test.describe('planVariantReconciliation — a value is dropped', () => {
  test('removes the variants carrying it rather than relabelling them', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE, COLOR],
      nextOptions: [SIZE, option(COLOR_ID, 'Color', [[WHITE, 'White']])],
      variants: [
        variant('var_1', 'S / White', { [SIZE_ID]: SMALL, [COLOR_ID]: WHITE }),
        variant('var_2', 'S / Black', { [SIZE_ID]: SMALL, [COLOR_ID]: BLACK }),
      ],
    })

    expect(plan.keep.map((entry) => entry.variantId)).toEqual(['var_1'])
    expect(plan.remove).toEqual([{ variantId: 'var_2', title: 'S / Black', reason: 'value-dropped' }])
  })
})

test.describe('planVariantReconciliation — an option is dropped', () => {
  test('collapses colliding variants onto the oldest', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE, COLOR],
      nextOptions: [SIZE],
      variants: [
        variant('var_1', 'S / White', { [SIZE_ID]: SMALL, [COLOR_ID]: WHITE }),
        variant('var_2', 'S / Black', { [SIZE_ID]: SMALL, [COLOR_ID]: BLACK }),
        variant('var_3', 'M / White', { [SIZE_ID]: MEDIUM, [COLOR_ID]: WHITE }),
      ],
    })

    expect(plan.reassign.map((entry) => [entry.variantId, entry.combination.label])).toEqual([
      ['var_1', 'S'],
      ['var_3', 'M'],
    ])
    expect(plan.remove).toEqual([{ variantId: 'var_2', title: 'S / Black', reason: 'collapsed' }])
    expect(plan.create).toEqual([])
  })
})

test.describe('planVariantReconciliation — the product stops offering options', () => {
  test('collapses onto a single variant, because there is one empty combination to hold', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE],
      nextOptions: [],
      variants: [variant('var_s', 'S', { [SIZE_ID]: SMALL }), variant('var_m', 'M', { [SIZE_ID]: MEDIUM })],
    })

    // A product offering no options has exactly one combination it can sell — the empty one — so
    // the survivors of dropping every option merge rather than each becoming a nameless duplicate.
    expect(plan.reassign.map((entry) => [entry.variantId, entry.combination.label])).toEqual([['var_s', '']])
    expect(plan.remove).toEqual([{ variantId: 'var_m', title: 'M', reason: 'collapsed' }])
    expect(plan.create).toEqual([])
  })

  test('a product that already has its one option-less variant is left alone', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [],
      nextOptions: [],
      variants: [variant('var_only', 'Enamel Mug', {})],
    })

    expect(plan.keep.map((entry) => entry.variantId)).toEqual(['var_only'])
    expect([plan.reassign, plan.create, plan.remove]).toEqual([[], [], []])
  })

  test('duplicate option-less variants collapse to the oldest', ({ expect }) => {
    // Reachable only by writing around the invariant, but the reconciliation is where it gets
    // corrected rather than carried forward.
    const plan = planVariantReconciliation({
      currentOptions: [],
      nextOptions: [],
      variants: [variant('var_first', 'Mug', {}), variant('var_second', 'Mug', {})],
    })

    expect(plan.keep.map((entry) => entry.variantId)).toEqual(['var_first'])
    expect(plan.remove).toEqual([{ variantId: 'var_second', title: 'Mug', reason: 'collapsed' }])
  })

  test('an option offering no values is not a dimension and is ignored', ({ expect }) => {
    const plan = planVariantReconciliation({
      currentOptions: [SIZE],
      nextOptions: [SIZE, option('opt_fit', 'Fit', [])],
      variants: [variant('var_s', 'S', { [SIZE_ID]: SMALL })],
    })

    // Multiplying by zero would otherwise make every combination vanish and delete the catalogue.
    expect(plan.keep.map((entry) => entry.variantId)).toEqual(['var_s'])
    expect(plan.remove).toEqual([])
    expect(plan.create.map((entry) => entry.combination.label)).toEqual(['M'])
  })
})

test.describe('planVariantReconciliation — a product that does not exist yet', () => {
  test('is the same call with no variants, and plans the whole matrix', ({ expect }) => {
    // What the create wizard needs: the grid rows for a draft product. One planner, both flows.
    const plan = planVariantReconciliation({ currentOptions: [], nextOptions: [SIZE, COLOR], variants: [] })

    expect(plan.create.map((entry) => entry.combination.label)).toEqual([
      'S / White',
      'S / Black',
      'M / White',
      'M / Black',
    ])
    expect(plan.create.every((entry) => entry.copyPricesFromVariantId === null)).toBe(true)
    expect([plan.keep, plan.reassign, plan.remove]).toEqual([[], [], []])
  })
})
