import type { ProductCategoryDTO } from '@core/types/product/common.js'
import type { StoreCardDTO } from '@core/types/store/common.js'
import { parseSublineTemplate, renderSubline } from '@core/utils/card-subline.js'
import { buildFieldValueLabel } from './build-field-value-label.js'

type SublineProduct = { id: string; brand: string | null }

/**
 * Each product's card subline from the store's `card.subline` template: `{type}` and `{brand}` as
 * written, a field's values by their labels (the Category naming each, else capitalised), several
 * joined by the card's `listSeparator`. A product whose template leaves nothing has `null`, and so has
 * every product when the store has no template.
 */
export function buildListingSublines(
  products: SublineProduct[],
  {
    card,
    typeByProductId,
    fieldValuesByProductId,
    categories,
  }: {
    card: StoreCardDTO
    typeByProductId: Map<string, string>
    fieldValuesByProductId: Record<string, Record<string, string[]>>
    categories: ProductCategoryDTO[]
  },
): Map<string, string | null> {
  const parsed = card.subline ? parseSublineTemplate(card.subline) : null
  // The file was checked when it was applied, so a template that no longer parses shows no subline.
  if (!parsed || 'error' in parsed) return new Map(products.map((product) => [product.id, null]))

  return new Map(
    products.map((product) => {
      const valuesOf = (key: string): string[] => {
        if (key === 'type') return [typeByProductId.get(product.id) ?? ''].filter(Boolean)
        if (key === 'brand') return product.brand ? [product.brand] : []
        const values = fieldValuesByProductId[product.id]?.[key] ?? []
        return values.map((value) => buildFieldValueLabel(key, value, categories))
      }
      return [product.id, renderSubline(parsed.template, valuesOf, card.listSeparator)]
    }),
  )
}
