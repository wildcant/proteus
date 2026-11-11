/**
 * The Shopify product CSV columns the import reads, by the field each one feeds. Headers are matched
 * after trimming, lower-casing and collapsing whitespace, so `URL Handle` and `url handle` are one
 * column. Several spellings map to one field where Shopify's own exports have used more than one.
 */
export const IMPORT_COLUMNS = {
  title: ['title'],
  handle: ['url handle', 'handle'],
  description: ['description', 'description (html)', 'body (html)'],
  status: ['status'],
  type: ['type'],
  tags: ['tags'],
  sku: ['sku'],
  weight: ['weight value (grams)'],
  price: ['price'],
  inventoryTracker: ['inventory tracker'],
  inventoryQuantity: ['inventory quantity'],
  continueSelling: ['continue selling when out of stock'],
  imageUrl: ['product image url'],
  imagePosition: ['image position'],
  variantImageUrl: ['variant image url'],
  option1Name: ['option1 name'],
  option1Value: ['option1 value'],
  option2Name: ['option2 name'],
  option2Value: ['option2 value'],
  option3Name: ['option3 name'],
  option3Value: ['option3 value'],
} as const

export type ImportColumn = keyof typeof IMPORT_COLUMNS

export const OPTION_COLUMNS = [
  { name: 'option1Name', value: 'option1Value' },
  { name: 'option2Name', value: 'option2Value' },
  { name: 'option3Name', value: 'option3Value' },
] as const

/** `Price / Colombia` — a price in the currency of the region the market names. */
export const MARKET_PRICE_HEADER = /^price \/ (.+)$/

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ')
}
