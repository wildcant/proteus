import { BigNumber } from '@core/bignumber.js'
import type { ImportedProductDTO, ImportedVariantDTO, ProductImportReferencesDTO } from '@core/types/product/common.js'
import type { CreateProductDTO, UpdateProductDTO } from '@core/types/product/mutations.js'
import type { AdminCreateProductVariantBody } from '@proteus/http-schemas/admin'

type ProductOptionEntry = { optionId: string; valueIds: string[] }

/** A variant already on the product, as the matcher compares it. */
export type ExistingImportVariant = { id: string; sku: string | null; optionValues: Record<string, string> }

/**
 * The fields an import writes on a product, the same on create and on overwrite. Categories and
 * collections are left out: ruled ones follow from the tags, and manual ones survive an overwrite.
 */
export function buildImportedProductFields(
  product: ImportedProductDTO,
  references: ProductImportReferencesDTO,
): CreateProductDTO & UpdateProductDTO {
  return {
    title: product.title,
    handle: product.handle,
    description: product.description,
    status: product.status,
    typeId: references.typeId,
    tagIds: references.tagIds,
  }
}

/** The variant's Option Combination as the id map a variant write takes. */
function importedCombination(
  variant: ImportedVariantDTO,
  product: ImportedProductDTO,
  references: ProductImportReferencesDTO,
): Record<string, string> {
  return Object.fromEntries(
    references.options.flatMap((option, index) => {
      const valueIndex = product.options[index]?.values.indexOf(variant.optionValues[index] ?? '') ?? -1
      const valueId = option.valueIds[valueIndex]
      return valueId ? [[option.optionId, valueId]] : []
    }),
  )
}

export function buildImportedVariant(
  variant: ImportedVariantDTO,
  product: ImportedProductDTO,
  references: ProductImportReferencesDTO,
): AdminCreateProductVariantBody {
  return {
    sku: variant.sku,
    weight: variant.weight,
    manageInventory: variant.manageInventory,
    allowBackorder: variant.allowBackorder,
    optionValues: importedCombination(variant, product, references),
    prices: variant.prices.map((price) => ({ currencyCode: price.currencyCode, amount: new BigNumber(price.amount) })),
  }
}

/** The product's options with the file's values added, so every imported variant names an offered value. */
export function mergeImportedOptions(
  existing: ProductOptionEntry[],
  references: ProductImportReferencesDTO,
): ProductOptionEntry[] {
  const merged = existing.map((option) => ({ optionId: option.optionId, valueIds: [...option.valueIds] }))
  for (const option of references.options) {
    const current = merged.find((entry) => entry.optionId === option.optionId)
    if (!current) {
      merged.push({ optionId: option.optionId, valueIds: [...option.valueIds] })
      continue
    }
    for (const valueId of option.valueIds) if (!current.valueIds.includes(valueId)) current.valueIds.push(valueId)
  }
  return merged
}

const combinationKey = (optionValues: Record<string, string>) =>
  Object.entries(optionValues)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([optionId, valueId]) => `${optionId}=${valueId}`)
    .join('&')

/**
 * Which variant already on the product each imported variant is: the one with its SKU, else the
 * one standing for its combination. `null` for a variant the product does not have yet.
 */
export function matchImportedVariants(
  product: ImportedProductDTO,
  references: ProductImportReferencesDTO,
  existing: ExistingImportVariant[],
): Array<{ variant: ImportedVariantDTO; variantId: string | null }> {
  const bySku = new Map(existing.flatMap((entry) => (entry.sku ? [[entry.sku, entry.id] as const] : [])))
  const byCombination = new Map(existing.map((entry) => [combinationKey(entry.optionValues), entry.id]))
  return product.variants.map((variant) => ({
    variant,
    variantId:
      (variant.sku ? bySku.get(variant.sku) : undefined) ??
      byCombination.get(combinationKey(importedCombination(variant, product, references))) ??
      null,
  }))
}
