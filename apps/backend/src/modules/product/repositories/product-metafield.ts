import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { ProductMetafieldDTO } from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productTable } from '../models/product.js'
import { productMetafieldTable } from '../models/product-metafield.js'
import { productMetafieldDefinitionTable } from '../models/product-metafield-definition.js'
import { productTypeTable } from '../models/product-type.js'

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

  /**
   * Every product's field values as sets by key, in three queries: its live metafield values, its
   * brand under the vendor field's key, and its Product Type under the type field's key, each when
   * that field is defined. A product with none maps to an empty map.
   */
  async findFieldValuesOfProducts(
    productIds: string[],
    context?: Context,
  ): Promise<Map<string, Map<string, Set<string>>>> {
    const byProduct = new Map<string, Map<string, Set<string>>>(productIds.map((productId) => [productId, new Map()]))
    const [metafieldRows, brandRows, typeRows] = await Promise.all([
      this.findRows(productIds, context),
      this.findBrandRows(productIds, context),
      this.findTypeRows(productIds, context),
    ])
    for (const row of [...metafieldRows, ...brandRows, ...typeRows]) {
      const fields = byProduct.get(row.productId)
      if (!fields) continue
      const values = fields.get(row.key) ?? new Set<string>()
      values.add(row.value)
      fields.set(row.key, values)
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
          eq(productMetafieldDefinitionTable.source, 'metafield'),
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

  /** Each product's brand under the live vendor field's key; none when no field is the vendor's. */
  private async findBrandRows(
    productIds: string[],
    context?: Context,
  ): Promise<{ productId: string; key: string; value: string }[]> {
    if (productIds.length === 0) return []
    const rows = await this.getClient(context)
      .select({
        productId: productTable.id,
        key: productMetafieldDefinitionTable.key,
        value: productTable.brand,
      })
      .from(productTable)
      .innerJoin(
        productMetafieldDefinitionTable,
        and(eq(productMetafieldDefinitionTable.source, 'vendor'), isNull(productMetafieldDefinitionTable.deletedAt)),
      )
      .where(and(inArray(productTable.id, productIds), isNotNull(productTable.brand)))
    return rows.flatMap((row) => (row.value === null ? [] : [{ ...row, value: row.value }]))
  }

  /** Each product's live Product Type under the type field's key; none when no field is the type's. */
  private async findTypeRows(
    productIds: string[],
    context?: Context,
  ): Promise<{ productId: string; key: string; value: string }[]> {
    if (productIds.length === 0) return []
    return this.getClient(context)
      .select({
        productId: productTable.id,
        key: productMetafieldDefinitionTable.key,
        value: productTypeTable.value,
      })
      .from(productTable)
      .innerJoin(
        productTypeTable,
        and(eq(productTypeTable.id, productTable.typeId), isNull(productTypeTable.deletedAt)),
      )
      .innerJoin(
        productMetafieldDefinitionTable,
        and(eq(productMetafieldDefinitionTable.source, 'type'), isNull(productMetafieldDefinitionTable.deletedAt)),
      )
      .where(inArray(productTable.id, productIds))
  }
}
