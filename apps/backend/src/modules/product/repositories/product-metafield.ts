import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { ProductMetafieldDTO } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productMetafieldTable } from '../models/product-metafield.js'
import { productMetafieldDefinitionTable } from '../models/product-metafield-definition.js'

type MetafieldRow = { productId: string; key: string; name: string; value: string }

/**
 * A product's metafield values, one row per value. Reads join only live definitions, so the values
 * of a deleted definition are never read even before the cascade reaches them.
 */
export class ProductMetafieldRepository extends BaseRepository(productMetafieldTable) {
  /**
   * Makes each listed definition hold exactly `values` on the product, in that order; definitions
   * left out are left alone. An unchanged list writes nothing.
   */
  async setProductMetafields(
    productId: string,
    valuesByDefinitionId: Map<string, string[]>,
    context?: Context,
  ): Promise<void> {
    const definitionIds = [...valuesByDefinitionId.keys()]
    if (definitionIds.length === 0) return

    const existing = await this.getClient(context)
      .select({
        id: productMetafieldTable.id,
        definitionId: productMetafieldTable.definitionId,
        value: productMetafieldTable.value,
      })
      .from(productMetafieldTable)
      .where(
        and(
          eq(productMetafieldTable.productId, productId),
          inArray(productMetafieldTable.definitionId, definitionIds),
          isNull(productMetafieldTable.deletedAt),
        ),
      )
      .orderBy(asc(productMetafieldTable.position), asc(productMetafieldTable.id))

    const stale: string[] = []
    const rows: { productId: string; definitionId: string; value: string; position: number }[] = []
    for (const [definitionId, values] of valuesByDefinitionId) {
      const wanted = [...new Set(values)]
      const current = existing.filter((row) => row.definitionId === definitionId)
      const unchanged =
        current.length === wanted.length && current.every((row, position) => row.value === wanted[position])
      if (unchanged) continue
      stale.push(...current.map((row) => row.id))
      rows.push(...wanted.map((value, position) => ({ productId, definitionId, value, position })))
    }

    await this.softDelete(stale, context)
    if (rows.length > 0) await this.createMany(rows, context)
  }

  /** Every product's live metafield values as sets by key, in one query. A product with none maps to an empty map. */
  async findMetafieldsOfProducts(
    productIds: string[],
    context?: Context,
  ): Promise<Map<string, Map<string, Set<string>>>> {
    const byProduct = new Map<string, Map<string, Set<string>>>(productIds.map((productId) => [productId, new Map()]))
    for (const row of await this.findRows(productIds, context)) {
      const metafields = byProduct.get(row.productId)
      if (!metafields) continue
      const values = metafields.get(row.key) ?? new Set<string>()
      values.add(row.value)
      metafields.set(row.key, values)
    }
    return byProduct
  }

  /** One product's metafields that hold values, by key, each list in its written order. */
  async findProductMetafields(productId: string, context?: Context): Promise<ProductMetafieldDTO[]> {
    const metafields: ProductMetafieldDTO[] = []
    for (const row of await this.findRows([productId], context)) {
      const last = metafields.at(-1)
      if (last?.key === row.key) last.values.push(row.value)
      else metafields.push({ key: row.key, name: row.name, values: [row.value] })
    }
    return metafields
  }

  private async findRows(productIds: string[], context?: Context): Promise<MetafieldRow[]> {
    if (productIds.length === 0) return []
    return this.getClient(context)
      .select({
        productId: productMetafieldTable.productId,
        key: productMetafieldDefinitionTable.key,
        name: productMetafieldDefinitionTable.name,
        value: productMetafieldTable.value,
      })
      .from(productMetafieldTable)
      .innerJoin(
        productMetafieldDefinitionTable,
        eq(productMetafieldDefinitionTable.id, productMetafieldTable.definitionId),
      )
      .where(
        and(
          inArray(productMetafieldTable.productId, productIds),
          isNull(productMetafieldTable.deletedAt),
          isNull(productMetafieldDefinitionTable.deletedAt),
        ),
      )
      .orderBy(
        asc(productMetafieldDefinitionTable.key),
        asc(productMetafieldTable.position),
        asc(productMetafieldTable.id),
      )
  }
}
