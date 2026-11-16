import type {
  ProductCollectionDTO,
  ProductListingOptionsDTO,
  VariantOptionLabelDTO,
} from '@core/types/product/common.js'

type CardVariant = { id: string; productId: string; variantRank: number | null }

type GroupValue = {
  value: string
  buckets: string[]
  thumbnail: string | null
  inStock: boolean
  variantId: string
}

const rankOf = (rank: number | null) => rank ?? Number.MAX_SAFE_INTEGER

/** The labels of the option `optionIdOf` names for each variant's product, keyed by variant. */
function labelsOfRole(
  variants: CardVariant[],
  labels: VariantOptionLabelDTO[],
  optionIdOf: (productId: string) => string | undefined,
): Map<string, VariantOptionLabelDTO> {
  const productIdByVariantId = new Map(variants.map((variant) => [variant.id, variant.productId]))
  return new Map(
    labels
      .filter((label) => {
        const productId = productIdByVariantId.get(label.variantId)
        return productId !== undefined && label.optionId === optionIdOf(productId)
      })
      .map((label) => [label.variantId, label]),
  )
}

/**
 * Each product's grouping values over `variants`, in the option's value order, each with the image of
 * its first variant (by variant rank) that has one, whether any of its variants can be bought, and the
 * variant the product page opens on: the product's sale variant when the value holds it, so the page opens
 * on the price the card shows, else the first that can be bought, else the first. A value no passed
 * variant carries — none priced here — is not one.
 */
export function buildListingGroups(
  variants: CardVariant[],
  labels: VariantOptionLabelDTO[],
  {
    listingOptions,
    imageUrlByVariantId,
    purchasableVariantIds,
    saleVariantIds,
  }: {
    listingOptions: Record<string, ProductListingOptionsDTO>
    imageUrlByVariantId: Map<string, string>
    purchasableVariantIds: Set<string>
    saleVariantIds: Set<string>
  },
): Map<string, { option: string; values: GroupValue[] }> {
  const labelByVariantId = labelsOfRole(variants, labels, (id) => listingOptions[id]?.grouping?.id)
  const ordered = [...variants].sort((a, b) => rankOf(a.variantRank) - rankOf(b.variantRank))

  const byProductId = new Map<string, Map<string, { rank: number | null; buckets: string[]; variantIds: string[] }>>()
  for (const variant of ordered) {
    const label = labelByVariantId.get(variant.id)
    if (!label) continue
    const byValue = byProductId.get(variant.productId) ?? new Map()
    const group = byValue.get(label.value) ?? { rank: label.rank, buckets: label.buckets, variantIds: [] }
    group.variantIds.push(variant.id)
    byValue.set(label.value, group)
    byProductId.set(variant.productId, byValue)
  }

  return new Map(
    [...byProductId].flatMap(([productId, byValue]) => {
      const option = listingOptions[productId]?.grouping
      if (!option) return []
      const values = [...byValue]
        .sort(([valueA, a], [valueB, b]) => rankOf(a.rank) - rankOf(b.rank) || valueA.localeCompare(valueB))
        .flatMap(([value, { buckets, variantIds }]) => {
          const [first] = variantIds
          if (first === undefined) return []
          return [
            {
              value,
              buckets,
              thumbnail: variantIds.map((id) => imageUrlByVariantId.get(id)).find((url) => url !== undefined) ?? null,
              inStock: variantIds.some((id) => purchasableVariantIds.has(id)),
              variantId:
                variantIds.find((id) => saleVariantIds.has(id)) ??
                variantIds.find((id) => purchasableVariantIds.has(id)) ??
                first,
            },
          ]
        })
      return [[productId, { option: option.title, values }]]
    }),
  )
}

/**
 * The first group value the request's filter on the grouping option selects, the colourway a card opens
 * on when the shopper filters by it: a value is selected by any of its buckets' names, or by itself
 * when it is in none, as the filter selects it. `null` when the filter names none of the values.
 */
export function findActiveGroupValue(
  groups: { option: string; values: GroupValue[] } | null,
  optionValues: Record<string, string[]> | undefined,
): GroupValue | null {
  const selected = groups ? optionValues?.[groups.option] : undefined
  if (!groups || !selected || selected.length === 0) return null
  return (
    groups.values.find((value) =>
      (value.buckets.length > 0 ? value.buckets : [value.value]).some((name) => selected.includes(name)),
    ) ?? null
  )
}

/**
 * Each product's availability values a shopper can buy now, in the option's order. `variants` are the
 * ones a shopper can buy; a value only sold-out variants carry is not one. A product with the option
 * but nothing in stock lists it with no values.
 */
export function buildListingAvailability(
  variants: CardVariant[],
  labels: VariantOptionLabelDTO[],
  listingOptions: Record<string, ProductListingOptionsDTO>,
): Map<string, { option: string; values: string[] }> {
  const labelByVariantId = labelsOfRole(variants, labels, (id) => listingOptions[id]?.availability?.id)
  const valuesByProductId = new Map<string, VariantOptionLabelDTO[]>()
  for (const variant of variants) {
    const label = labelByVariantId.get(variant.id)
    if (!label) continue
    const values = valuesByProductId.get(variant.productId) ?? []
    if (!values.some((value) => value.value === label.value)) values.push(label)
    valuesByProductId.set(variant.productId, values)
  }
  return new Map(
    Object.entries(listingOptions).flatMap(([productId, { availability }]) => {
      if (!availability) return []
      const values = (valuesByProductId.get(productId) ?? []).sort(compareOptionValues).map((label) => label.value)
      return [[productId, { option: availability.title, values }]]
    }),
  )
}

/** The badges of the product's Collections, each once, in the order the Collections come. */
export function buildListingBadges(collections: ProductCollectionDTO[]): string[] {
  return [...new Set(collections.flatMap((collection) => (collection.badge ? [collection.badge] : [])))]
}

/** Each variant's first image, in the product's image order: what a group value's thumbnail is read from. */
export function buildVariantImageUrls(
  links: Array<{ variantId: string; imageId: string }>,
  images: Array<{ id: string; url: string; rank: number }>,
): Map<string, string> {
  const imageById = new Map(images.map((image) => [image.id, image]))
  const firstByVariantId = new Map<string, { url: string; rank: number }>()
  for (const link of links) {
    const image = imageById.get(link.imageId)
    const first = firstByVariantId.get(link.variantId)
    if (image && (!first || image.rank < first.rank)) firstByVariantId.set(link.variantId, image)
  }
  return new Map([...firstByVariantId].map(([variantId, image]) => [variantId, image.url]))
}

const NUMBER = /^\d+([.,]\d+)?$/

/**
 * The option's own rank first; values it leaves tied go by number when they are numbers, so a size 9
 * comes before 10, and by text otherwise.
 */
function compareOptionValues(a: VariantOptionLabelDTO, b: VariantOptionLabelDTO): number {
  const byRank = rankOf(a.rank) - rankOf(b.rank)
  if (byRank !== 0) return byRank
  if (NUMBER.test(a.value) && NUMBER.test(b.value)) {
    return Number(a.value.replace(',', '.')) - Number(b.value.replace(',', '.'))
  }
  return a.value.localeCompare(b.value)
}
