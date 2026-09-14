import type { CreateInventoryItemDTO } from '@core/types/inventory/mutations.js'

/**
 * The variant fields an Inventory Item is seeded from.
 *
 * Structural rather than the product module's DTO, because the same map is applied to a variant
 * that has just been created and to one being tracked again after a spell untracked — and the
 * second is read back off the database rather than handed in.
 */
export type VariantInventorySeed = {
  title: string
  sku: string | null
  originCountry: string | null
  hsCode: string | null
  midCode: string | null
  material: string | null
  weight: number | null
  length: number | null
  height: number | null
  width: number | null
}

/**
 * Medusa's field map, from a variant onto the Inventory Item that stands behind it.
 *
 * Two of its entries have no variant column here to read. `description` takes the variant's title,
 * which is what Medusa puts there. `requiresShipping` is stated rather than left to the column
 * default, so the map is visibly complete: Medusa reads the variant's own `requires_shipping`,
 * this schema has no such column, and everything the shop sells is physical until one exists.
 *
 * The four dimensions are rounded because a variant carries them as `double precision` and an
 * Inventory Item as `integer`. Postgres rounds them on the way in either way; doing it here is the
 * same answer arrived at somewhere it can be read.
 */
export function buildVariantInventoryItems(variants: VariantInventorySeed[]): CreateInventoryItemDTO[] {
  return variants.map((variant) => ({
    sku: variant.sku,
    title: variant.title,
    description: variant.title,
    originCountry: variant.originCountry,
    hsCode: variant.hsCode,
    midCode: variant.midCode,
    material: variant.material,
    weight: toWholeUnits(variant.weight),
    length: toWholeUnits(variant.length),
    height: toWholeUnits(variant.height),
    width: toWholeUnits(variant.width),
    requiresShipping: true,
  }))
}

function toWholeUnits(measurement: number | null): number | null {
  return measurement === null ? null : Math.round(measurement)
}
