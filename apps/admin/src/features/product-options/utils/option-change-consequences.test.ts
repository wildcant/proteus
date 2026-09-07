import { describe, expect, test } from 'vitest'
import type { AdminProductScopedOption } from '#/api/generated/model'
import { describeOptionChange } from './option-change-consequences'

const scoped = (id: string, title: string, values: Array<[string, string, number]>): AdminProductScopedOption =>
  ({
    id,
    title,
    values: values.map(([valueId, value, variantCount]) => ({ id: valueId, value, variantCount })),
  }) as AdminProductScopedOption

const SIZE = scoped('opt_size', 'Size', [
  ['v_s', 'S', 2],
  ['v_m', 'M', 2],
])
const COLOR = scoped('opt_color', 'Color', [
  ['v_wht', 'White', 2],
  ['v_blk', 'Black', 0],
])

describe('describeOptionChange', () => {
  test('an unchanged option set destroys nothing', () => {
    const consequences = describeOptionChange(
      [SIZE, COLOR],
      [
        { optionId: 'opt_size', valueIds: ['v_s', 'v_m'] },
        { optionId: 'opt_color', valueIds: ['v_wht', 'v_blk'] },
      ],
    )

    expect(consequences.isDestructive).toBe(false)
  })

  test('a dropped value is counted exactly, from the server side count', () => {
    const consequences = describeOptionChange(
      [SIZE, COLOR],
      [
        { optionId: 'opt_size', valueIds: ['v_s', 'v_m'] },
        { optionId: 'opt_color', valueIds: ['v_blk'] },
      ],
    )

    expect(consequences.droppedValues).toEqual([{ label: 'Color / White', variantCount: 2 }])
    expect(consequences.isDestructive).toBe(true)
  })

  test('a dropped value no variant carries is not announced', () => {
    // Nothing is destroyed, so there is nothing to warn about.
    const consequences = describeOptionChange(
      [SIZE, COLOR],
      [
        { optionId: 'opt_size', valueIds: ['v_s', 'v_m'] },
        { optionId: 'opt_color', valueIds: ['v_wht'] },
      ],
    )

    expect(consequences.droppedValues).toEqual([])
    expect(consequences.isDestructive).toBe(false)
  })

  test('a dropped option is named but never counted', () => {
    // How many survive a collapse is a function of the whole variant set. Guessing it here would
    // mean re-implementing the reconciler in the client.
    const consequences = describeOptionChange([SIZE, COLOR], [{ optionId: 'opt_size', valueIds: ['v_s', 'v_m'] }])

    expect(consequences.droppedOptions).toEqual(['Color'])
    expect(consequences.droppedValues).toEqual([])
    expect(consequences.isDestructive).toBe(true)
  })
})
