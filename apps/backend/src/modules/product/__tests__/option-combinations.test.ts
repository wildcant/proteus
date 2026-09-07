import { test } from '@tests/setup/test-extend.js'
import {
  buildCombinations,
  buildPickerTargets,
  type CombinableOption,
  type CombinableVariant,
  combinationKey,
  countCombinations,
  findCombination,
} from '../utils/option-combinations.js'

const option = (id: string, title: string, values: Array<[string, string]>): CombinableOption => ({
  id,
  title,
  values: values.map(([valueId, value]) => ({ id: valueId, value })),
})

const variant = (id: string, optionValues: Record<string, string>, inStock = true): CombinableVariant => ({
  id,
  optionValues,
  inStock,
})

// Prefixed ids like the database generates. Held as constants so every combination below is built
// with computed keys, which is also what real callers do.
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
const OPTIONS = [SIZE, COLOR]

const S_WHITE = { [SIZE_ID]: SMALL, [COLOR_ID]: WHITE }
const S_BLACK = { [SIZE_ID]: SMALL, [COLOR_ID]: BLACK }
const M_WHITE = { [SIZE_ID]: MEDIUM, [COLOR_ID]: WHITE }
const M_BLACK = { [SIZE_ID]: MEDIUM, [COLOR_ID]: BLACK }

test.describe('countCombinations', () => {
  test('multiplies the value counts', ({ expect }) => {
    expect(countCombinations(OPTIONS)).toBe(4)
  })

  test('a product with no options has no combinations', ({ expect }) => {
    // Not 1. The empty product is mathematically one empty combination, but a variant with no options
    // is not a combination of anything, and the ceiling check must not treat it as one.
    expect(countCombinations([])).toBe(0)
  })

  test('an option offering no values collapses the count to zero', ({ expect }) => {
    // I4 makes this state unreachable through the service — an option a product offers must offer a
    // value. It stays covered here because the pure layer is the last line of defence against the
    // one path that skips the service, and because `planVariantReconciliation` filters on it for
    // exactly this reason: left in, it multiplies the count to zero and plans a deletion of
    // everything. See docs/product-options.md.
    expect(countCombinations([SIZE, option('opt_fit', 'Fit', [])])).toBe(0)
  })

  test('counts without enumerating, so the ceiling can be checked safely', ({ expect }) => {
    // The guard exists to avoid materialising a pathological matrix. Counting one would defeat it.
    const wide = Array.from({ length: 6 }, (_, index) =>
      option(
        `opt_${index}`,
        `Option ${index}`,
        Array.from({ length: 10 }, (_, value) => [`v_${index}_${value}`, `Value ${value}`] as [string, string]),
      ),
    )

    expect(countCombinations(wide)).toBe(1_000_000)
  })
})

test.describe('combinationKey', () => {
  test('does not depend on key insertion order', ({ expect }) => {
    expect(combinationKey({ [SIZE_ID]: MEDIUM, [COLOR_ID]: WHITE })).toBe(
      combinationKey({ [COLOR_ID]: WHITE, [SIZE_ID]: MEDIUM }),
    )
  })

  test('different combinations get different keys', ({ expect }) => {
    expect(combinationKey(M_WHITE)).not.toBe(combinationKey(M_BLACK))
  })

  test('a value moving between options is not the same combination', ({ expect }) => {
    // Guards against a key built from values alone: the option a value sits under is part of the
    // identity, or "Size: red" and "Color: red" would collide.
    expect(combinationKey({ [SIZE_ID]: 'v_x' })).not.toBe(combinationKey({ [COLOR_ID]: 'v_x' }))
  })
})

test.describe('buildCombinations', () => {
  test('produces every combination of the offered values', ({ expect }) => {
    const combinations = buildCombinations({ options: OPTIONS, variants: [] })

    expect(combinations).toHaveLength(4)
    expect(combinations.map((combination) => combination.label)).toEqual([
      'S / White',
      'S / Black',
      'M / White',
      'M / Black',
    ])
  })

  test('values follow the product option order, not the variant key order', ({ expect }) => {
    // The label and the table columns both read this array positionally, so the order is the
    // contract. A variant whose stored map happens to list Color first must not reorder it.
    const [first] = buildCombinations({
      options: OPTIONS,
      variants: [variant('var_1', { [COLOR_ID]: WHITE, [SIZE_ID]: SMALL })],
    })

    expect(first?.values.map((value) => value.optionTitle)).toEqual(['Size', 'Color'])
    expect(first?.values.map((value) => value.value)).toEqual(['S', 'White'])
  })

  test('names the variant that already carries a combination', ({ expect }) => {
    const combinations = buildCombinations({ options: OPTIONS, variants: [variant('var_1', M_WHITE)] })

    const taken = combinations.find((combination) => combination.label === 'M / White')
    expect(taken?.variantId).toBe('var_1')
  })

  test('leaves untaken combinations free', ({ expect }) => {
    const combinations = buildCombinations({ options: OPTIONS, variants: [variant('var_1', M_WHITE)] })

    const free = combinations.filter((combination) => combination.variantId === null)
    expect(free.map((combination) => combination.label)).toEqual(['S / White', 'S / Black', 'M / Black'])
  })

  test('matches a variant whose stored map lists options in a different order', ({ expect }) => {
    const combinations = buildCombinations({
      options: OPTIONS,
      variants: [variant('var_1', { [COLOR_ID]: WHITE, [SIZE_ID]: MEDIUM })],
    })

    expect(combinations.find((combination) => combination.label === 'M / White')?.variantId).toBe('var_1')
  })

  test('ignores a variant carrying no option values', ({ expect }) => {
    // Data created before variants carried options. It takes no combination, so every one stays free.
    const combinations = buildCombinations({ options: OPTIONS, variants: [variant('var_legacy', {})] })

    expect(combinations.every((combination) => combination.variantId === null)).toBe(true)
  })

  test('ignores a variant with an incomplete combination', ({ expect }) => {
    // A half-assigned variant does not occupy any full combination, so nothing may be hidden
    // because of it.
    const combinations = buildCombinations({ options: OPTIONS, variants: [variant('var_1', { [SIZE_ID]: MEDIUM })] })

    expect(combinations.every((combination) => combination.variantId === null)).toBe(true)
  })

  test('carries the write payload alongside the resolved values', ({ expect }) => {
    const [first] = buildCombinations({ options: OPTIONS, variants: [] })

    expect(first?.optionValues).toEqual(S_WHITE)
  })

  test('a product with no options has no combinations', ({ expect }) => {
    expect(buildCombinations({ options: [], variants: [] })).toEqual([])
  })

  test('an option offering no values yields nothing rather than a partial row', ({ expect }) => {
    // The fold would otherwise emit combinations missing that option, which the service rejects.
    // Unreachable through the service since I4, and kept for the same reason as the count above.
    expect(buildCombinations({ options: [SIZE, option('opt_fit', 'Fit', [])], variants: [] })).toEqual([])
  })
})

test.describe('findCombination', () => {
  const combinations = buildCombinations({ options: OPTIONS, variants: [variant('var_1', M_WHITE)] })

  test('finds a combination regardless of the map key order', ({ expect }) => {
    expect(findCombination(combinations, { [COLOR_ID]: WHITE, [SIZE_ID]: MEDIUM })?.variantId).toBe('var_1')
  })

  test('returns nothing for an incomplete map', ({ expect }) => {
    expect(findCombination(combinations, { [SIZE_ID]: MEDIUM })).toBeUndefined()
  })

  test('returns nothing for a value the product does not offer', ({ expect }) => {
    expect(findCombination(combinations, { [SIZE_ID]: MEDIUM, [COLOR_ID]: 'v_red' })).toBeUndefined()
  })
})

test.describe('buildPickerTargets', () => {
  test("a variant's own values target itself, so the picker can mark them selected", ({ expect }) => {
    // The storefront derives `isSelected` as `target === selectedVariantId`. If a sibling sharing
    // the prefix won the lookup instead, nothing would ever render as selected.
    const variants = [variant('var_mw', M_WHITE), variant('var_mb', M_BLACK)]

    const targets = buildPickerTargets({ options: OPTIONS, variants })

    expect(targets.var_mw?.[MEDIUM]).toBe('var_mw')
    expect(targets.var_mw?.[WHITE]).toBe('var_mw')
  })

  test('a value no variant carries is unavailable', ({ expect }) => {
    const targets = buildPickerTargets({ options: OPTIONS, variants: [variant('var_mw', M_WHITE)] })

    expect(targets.var_mw?.[BLACK]).toBeNull()
  })

  test('the first option stays open even when the selection rules the value out later', ({ expect }) => {
    // The left-to-right cascade is what keeps every combination reachable. Sitting on M/Black,
    // S must still be clickable even though no S/Black exists — evaluating each option against
    // all the others would dead-end the shopper here.
    const variants = [variant('var_sw', S_WHITE), variant('var_mb', M_BLACK)]

    const targets = buildPickerTargets({ options: OPTIONS, variants })

    expect(targets.var_mb?.[SMALL]).toBe('var_sw')
  })

  test('a later option is constrained by the selection above it', ({ expect }) => {
    const variants = [variant('var_sw', S_WHITE), variant('var_mb', M_BLACK)]

    const targets = buildPickerTargets({ options: OPTIONS, variants })

    // Sitting on S/White, Black is not reachable without changing Size first.
    expect(targets.var_sw?.[BLACK]).toBeNull()
  })

  test('switching one option keeps the rest of the selection where it can', ({ expect }) => {
    // Clicking S while on M/Black should land on S/Black, not on whichever S variant happens to
    // come first in the array.
    const variants = [variant('var_sw', S_WHITE), variant('var_sb', S_BLACK), variant('var_mb', M_BLACK)]

    const targets = buildPickerTargets({ options: OPTIONS, variants })

    expect(targets.var_mb?.[SMALL]).toBe('var_sb')
  })

  test('an out-of-stock variant is not a target', ({ expect }) => {
    const variants = [variant('var_mw', M_WHITE), variant('var_mb', M_BLACK, false)]

    const targets = buildPickerTargets({ options: OPTIONS, variants })

    expect(targets.var_mw?.[BLACK]).toBeNull()
  })

  test('the selected variant stays selected even when it is out of stock', ({ expect }) => {
    // A shopper can navigate straight to a sold-out variant. Its own values must still read as
    // selected rather than the whole picker going blank.
    const variants = [variant('var_mw', M_WHITE, false), variant('var_mb', M_BLACK)]

    const targets = buildPickerTargets({ options: OPTIONS, variants })

    expect(targets.var_mw?.[MEDIUM]).toBe('var_mw')
    expect(targets.var_mw?.[WHITE]).toBe('var_mw')
  })

  test('a variant carrying no option values gets no targets', ({ expect }) => {
    const targets = buildPickerTargets({ options: OPTIONS, variants: [variant('var_legacy', {})] })

    expect(targets.var_legacy).toEqual({})
  })
})
