import { and, asc, count, desc, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm'
import type { Context } from '../../core/types/context.js'
import type { ListVariantStockOptions, VariantStockDTO } from '../../core/types/link/common.js'
import { BaseRepository } from '../../core/utils/base-repository.js'
import { productVariantInventoryItemTable } from '../definitions/product-variant-inventory-item.js'
import { inventoryItemTable, inventoryLevelTable, productTable, productVariantTable } from '../modules-definitions.js'

/**
 * A closed list, so a client cannot order by a column the join does not select — the summed
 * quantities are output aliases rather than columns, which only Postgres's ORDER BY resolves.
 */
const SORTABLE = {
  productTitle: sql`${productTable.title}`,
  variantTitle: sql`${productVariantTable.title}`,
  sku: sql`${productVariantTable.sku}`,
  stockedQuantity: sql`stocked_quantity`,
  reservedQuantity: sql`reserved_quantity`,
  availableQuantity: sql`available_quantity`,
} as const

export class ProductVariantInventoryItemRepository extends BaseRepository(productVariantInventoryItemTable) {
  async findByVariantIds(variantIds: string[], context?: Context) {
    if (variantIds.length === 0) return []
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(and(inArray(this.table.variantId, variantIds), isNull(this.table.deletedAt)))
  }

  /**
   * The mirror of {@link findByVariantIds}, for a reader holding an Inventory Item id and needing
   * the variant it belongs to — the low-stock subscriber starts from a level, and a level names
   * the item rather than the variant.
   */
  async findByInventoryItemIds(inventoryItemIds: string[], context?: Context) {
    if (inventoryItemIds.length === 0) return []
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(and(inArray(this.table.inventoryItemId, inventoryItemIds), isNull(this.table.deletedAt)))
  }

  async getInventoryAvailability(variantIds: string[], context?: Context) {
    if (variantIds.length === 0) return []
    const client = this.getClient(context)
    return client
      .select({
        variantId: this.table.variantId,
        inventoryItemId: this.table.inventoryItemId,
        requiredQuantity: this.table.requiredQuantity,
        locationId: inventoryLevelTable.locationId,
        stockedQuantity: inventoryLevelTable.stockedQuantity,
        reservedQuantity: inventoryLevelTable.reservedQuantity,
      })
      .from(this.table)
      .innerJoin(inventoryLevelTable, eq(this.table.inventoryItemId, inventoryLevelTable.inventoryItemId))
      .where(and(inArray(this.table.variantId, variantIds), isNull(this.table.deletedAt)))
  }

  /**
   * Every tracked variant's stock in one query: the link, its Inventory Levels, and the variant
   * and product the shopkeeper reads the row by.
   *
   * The join lives here rather than in the route because the route cannot sort or paginate what
   * four modules each hold a column of — ordering by Available Quantity across a page of
   * separately-listed variants would sort one page's worth of rows and call it the shop.
   *
   * The levels are summed rather than joined row-per-location, so the shop stays one row per
   * variant when a second Stock Location arrives. A tracked variant whose levels are all gone
   * still shows, at zero: it is stock the shopkeeper has none of, not a variant that does not
   * exist. The sku is the variant's own — the Inventory Item copies it at creation and never
   * hears about a later rename.
   */
  async listVariantStockAndCount(
    options: ListVariantStockOptions,
    context?: Context,
  ): Promise<[VariantStockDTO[], number]> {
    const client = this.getClient(context)

    const stocked = sql<number>`COALESCE(SUM(${inventoryLevelTable.stockedQuantity}), 0)::int`
    const reserved = sql<number>`COALESCE(SUM(${inventoryLevelTable.reservedQuantity}), 0)::int`
    const available = sql<number>`COALESCE(SUM(${inventoryLevelTable.stockedQuantity} - ${inventoryLevelTable.reservedQuantity}), 0)::int`

    const rows = () =>
      client
        .select({
          id: inventoryItemTable.id,
          sku: productVariantTable.sku,
          productId: productTable.id,
          productTitle: productTable.title,
          variantId: productVariantTable.id,
          variantTitle: productVariantTable.title,
          stockedQuantity: stocked.as('stocked_quantity'),
          reservedQuantity: reserved.as('reserved_quantity'),
          availableQuantity: available.as('available_quantity'),
        })
        .from(this.table)
        .innerJoin(
          inventoryItemTable,
          and(eq(this.table.inventoryItemId, inventoryItemTable.id), isNull(inventoryItemTable.deletedAt)),
        )
        .innerJoin(
          productVariantTable,
          and(eq(this.table.variantId, productVariantTable.id), isNull(productVariantTable.deletedAt)),
        )
        .innerJoin(
          productTable,
          and(eq(productVariantTable.productId, productTable.id), isNull(productTable.deletedAt)),
        )
        .leftJoin(
          inventoryLevelTable,
          and(
            eq(inventoryLevelTable.inventoryItemId, this.table.inventoryItemId),
            isNull(inventoryLevelTable.deletedAt),
          ),
        )
        .where(isNull(this.table.deletedAt))
        .groupBy(inventoryItemTable.id, productVariantTable.id, productTable.id)
        .having(options.atOrBelow === undefined ? undefined : sql`${available} <= ${options.atOrBelow}`)

    const page = await rows()
      .orderBy(...this.buildStockOrder(options.order))
      .limit(options.limit)
      .offset(options.offset)

    const [counted] = await client.select({ value: count() }).from(rows().as('variant_stock'))

    return [page as VariantStockDTO[], counted?.value ?? 0]
  }

  /** Product then variant unless asked otherwise, so a shop reads as its catalogue does. */
  private buildStockOrder(order?: Record<string, 'ASC' | 'DESC'>): SQL[] {
    const requested = Object.entries(order ?? {})
      .filter(([key]) => key in SORTABLE)
      .map(([key, direction]) => {
        const column = SORTABLE[key as keyof typeof SORTABLE]
        return direction === 'DESC' ? desc(column) : asc(column)
      })

    if (requested.length) return [...requested, asc(sql`${inventoryItemTable.id}`)]

    return [asc(sql`${productTable.title}`), asc(sql`${productVariantTable.title}`), asc(sql`${inventoryItemTable.id}`)]
  }
}
