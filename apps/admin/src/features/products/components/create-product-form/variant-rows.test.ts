import { describe, expect, it } from 'vitest'
import {
  fromVariantGridRows,
  resolveVariantsPayload,
  toVariantGridRows,
  type VariantRow,
} from '#/features/products/components/create-product-form/variant-rows'

const row: VariantRow = {
  key: 'size=m',
  label: 'M',
  optionValues: { size: 'm' },
  sku: '',
  prices: { usd: '', cop: '' },
  compareAtPrices: { usd: '', cop: '' },
}

describe('variant grid rows', () => {
  it('carries a typed compare-at back onto its own field and sends it beside its price', () => {
    const [gridRow] = toVariantGridRows([row])
    expect(gridRow).toEqual({ label: 'M', sku: '', usd: '', cop: '', 'compareAt:usd': '', 'compareAt:cop': '' })

    const [edited] = fromVariantGridRows(
      [row],
      [{ ...gridRow, sku: 'TEE-M', usd: '80', 'compareAt:usd': '100', 'compareAt:cop': '500000' }],
    )
    expect(edited).toEqual({
      ...row,
      sku: 'TEE-M',
      prices: { usd: '80', cop: '' },
      compareAtPrices: { usd: '100', cop: '500000' },
    })

    // The COP compare-at has no price beside it, so COP is not sent at all.
    expect(resolveVariantsPayload({ hasVariants: true, options: [], rows: [edited ?? row] }).variants).toEqual([
      {
        optionValues: { size: 'm' },
        variantRank: 0,
        sku: 'TEE-M',
        prices: [{ currencyCode: 'usd', amount: '80', compareAtAmount: '100' }],
      },
    ])
  })
})
