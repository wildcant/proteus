import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreProductScopedOption, StoreProductVariant } from '#/api/generated/model'
import { I18nTestProvider } from '#/lib/i18n/test-i18n'
import { VariantPicker } from './variant-picker'

/**
 * The picker, handed the targets the API precomputed.
 *
 * A `null` target is the one bit of stock the picker reads, and it is derived server-side from the
 * same projection the button refuses on — so what is crossed out here and what the button refuses
 * cannot disagree. Which combinations come back `null` is `product.api.test.ts`; how they are drawn
 * is below.
 */

const smallValue = { id: 'optval_small', value: 'S', rank: 0, swatchImageUrl: null }
const mediumValue = { id: 'optval_medium', value: 'M', rank: 1, swatchImageUrl: null }

const size: StoreProductScopedOption = {
  id: 'opt_size',
  title: 'Size',
  renderAs: 'text',
  values: [smallValue, mediumValue],
}

function variant(id: string, valueId: string): StoreProductVariant {
  return {
    id,
    productId: 'prod_shorts',
    title: 'Sport Shorts',
    thumbnail: null,
    imageIds: [],
    optionValues: { [size.id]: valueId },
    stock: { state: 'available' },
    sku: null,
    barcode: null,
    material: null,
    weight: null,
    length: null,
    height: null,
    width: null,
    calculatedPrice: { id: 'price_1', currencyCode: 'usd', calculatedAmount: '46.00' },
  }
}

const small = variant('variant_small', smallValue.id)
const medium = variant('variant_medium', mediumValue.id)

test('a combination that cannot be bought is struck through, not merely dimmed', async () => {
  render(
    <VariantPicker
      options={[size]}
      variants={[small, medium]}
      // Standing on M, with S sold out: no buyable variant carries S, so it leads nowhere.
      pickerTargets={{ [medium.id]: { [smallValue.id]: null, [mediumValue.id]: medium.id } }}
      selectedVariant={medium}
      onVariantChange={() => undefined}
    />,
    { wrapper: I18nTestProvider },
  )

  const unreachable = page.getByRole('radio', { name: 'S' })
  await expect.element(unreachable).toBeDisabled()

  // The label is the input's next sibling — the input is `sr-only`, so the label is the whole of
  // what a shopper sees. Read off the real Chromium rather than off a class name, because a class
  // list that contains `line-through` and a garment that reads as struck through are not the same
  // claim: a later `no-underline` on an ancestor would satisfy one and break the other.
  const label = unreachable.element().nextElementSibling
  expect(label).toBeInstanceOf(HTMLLabelElement)
  expect(label && getComputedStyle(label).textDecorationLine).toBe('line-through')

  // The value the shopper is standing on shares the muted treatment with nothing: a strike on
  // every cell would say exactly as much as a strike on none.
  const reachable = page.getByRole('radio', { name: 'M' }).element().nextElementSibling
  expect(reachable && getComputedStyle(reachable).textDecorationLine).toBe('none')
})
