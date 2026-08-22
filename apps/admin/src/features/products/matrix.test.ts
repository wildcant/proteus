import { describe, expect, test } from 'vitest'
import type { AdminProductOption, AdminProductVariant } from '#/api/generated/model'
import { buildVariantMatrix } from './matrix'

const SIZE = 'opt_size'
const COLOUR = 'opt_colour'

const option = (id: string, title: string, values: string[]) =>
  ({
    id,
    title,
    renderAs: 'text',
    metadata: null,
    values: values.map((value, rank) => ({
      id: `${id}_${value}`,
      optionId: id,
      value,
      rank,
      metadata: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }) as AdminProductOption

const variant = (id: string, optionValues: Record<string, string>) => ({ id, optionValues }) as AdminProductVariant

const options = [option(SIZE, 'Size', ['S', 'M']), option(COLOUR, 'Colour', ['Black', 'White'])]
const everyValue = {
  [SIZE]: [`${SIZE}_S`, `${SIZE}_M`],
  [COLOUR]: [`${COLOUR}_Black`, `${COLOUR}_White`],
}

describe('buildVariantMatrix', () => {
  test('produces every combination of the chosen values', () => {
    const rows = buildVariantMatrix({ options, selectedValueIds: everyValue, existingVariants: [] })

    expect(rows.map((row) => row.title)).toEqual(['S / Black', 'S / White', 'M / Black', 'M / White'])
  })

  test('drops combinations a variant already carries', () => {
    const existing = [variant('v_1', { [SIZE]: `${SIZE}_S`, [COLOUR]: `${COLOUR}_Black` })]

    const rows = buildVariantMatrix({ options, selectedValueIds: everyValue, existingVariants: existing })

    expect(rows.map((row) => row.title)).toEqual(['S / White', 'M / Black', 'M / White'])
  })

  test('builds nothing when an option has no value chosen, since a partial tuple is rejected', () => {
    const rows = buildVariantMatrix({
      options,
      selectedValueIds: { [SIZE]: [`${SIZE}_S`] },
      existingVariants: [],
    })

    expect(rows).toEqual([])
  })

  test('generates a SKU stub from the prefix and the values', () => {
    const rows = buildVariantMatrix({
      options,
      selectedValueIds: { [SIZE]: [`${SIZE}_S`], [COLOUR]: [`${COLOUR}_Black`] },
      existingVariants: [],
      skuPrefix: 'shirt',
    })

    expect(rows[0]?.sku).toBe('SHIRT-S-BLACK')
  })

  test('leaves the SKU empty when no prefix is given', () => {
    const rows = buildVariantMatrix({ options, selectedValueIds: everyValue, existingVariants: [] })

    expect(rows.every((row) => row.sku === '')).toBe(true)
  })

  test('each row carries the full tuple keyed by option id', () => {
    const rows = buildVariantMatrix({
      options,
      selectedValueIds: { [SIZE]: [`${SIZE}_M`], [COLOUR]: [`${COLOUR}_White`] },
      existingVariants: [],
    })

    expect(rows[0]?.optionValues).toEqual({ [SIZE]: `${SIZE}_M`, [COLOUR]: `${COLOUR}_White` })
  })

  test('an existing tuple matches regardless of key order', () => {
    const existing = [variant('v_1', { [COLOUR]: `${COLOUR}_Black`, [SIZE]: `${SIZE}_S` })]

    const rows = buildVariantMatrix({ options, selectedValueIds: everyValue, existingVariants: existing })

    expect(rows.map((row) => row.title)).not.toContain('S / Black')
  })
})
