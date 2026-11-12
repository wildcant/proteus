import { and, asc, eq, type InferInsertModel, type InferSelectModel, inArray, isNull, type SQL } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { Context } from '../../../core/types/context.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'

type TextColumn = AnyPgColumn<{ data: string }>

type PivotTable<TKey extends string> = PgTable & { id: TextColumn; productId: TextColumn; deletedAt: AnyPgColumn } & {
  [K in TKey]: TextColumn
}

type GroupingTable = PgTable & { id: TextColumn; deletedAt: AnyPgColumn }

/**
 * The repository of a pivot joining products to a grouping — a Category, a Collection or a Tag. The
 * three differ only in their tables, the pivot column naming the grouping, and the column a
 * product's groupings sort by, so each extends this with its own.
 *
 * Every read joins only live rows: a write checks the foreign key only, so a pivot can name a
 * grouping that was soft-deleted since.
 */
export function ProductGroupingPivotRepository<
  TKey extends string,
  TPivot extends PivotTable<TKey>,
  TGrouping extends GroupingTable,
>({
  pivot,
  groupingKey,
  grouping,
  orderBy,
}: {
  pivot: TPivot
  /** The pivot's column naming the grouping row: `categoryId`, `collectionId`, `tagId`. */
  groupingKey: TKey
  grouping: TGrouping
  /** What a product's groupings sort by, before `id`. */
  orderBy: AnyPgColumn
}) {
  type Grouping = InferSelectModel<TGrouping>
  const groupingColumn: TextColumn = pivot[groupingKey]
  // Drizzle cannot type a query over a generic table, so the queries read the tables widened and
  // assert their rows — every column they name is a `TextColumn` of a non-null pivot or grouping.
  const pivotTable: PgTable = pivot
  const groupingTable: PgTable = grouping

  return class ProductGroupingPivot extends BaseRepository(pivot) {
    /**
     * Adds then removes members of one grouping. A product already in is left alone, and so is one
     * asked to leave that was never in. An unknown product id is a foreign-key violation.
     */
    async setProducts(
      groupingId: string,
      { add = [], remove = [] }: { add?: string[]; remove?: string[] },
      context?: Context,
    ): Promise<void> {
      const toAdd = [...new Set(add)]
      if (toAdd.length > 0) {
        const members = await this.findLive(
          and(eq(groupingColumn, groupingId), inArray(pivot.productId, toAdd)),
          context,
        )
        const memberIds = new Set(members.map((member) => member.productId))
        await this.createRows(
          toAdd.filter((productId) => !memberIds.has(productId)).map((productId) => ({ productId, groupingId })),
          context,
        )
      }

      if (remove.length > 0) {
        const leaving = await this.findLive(
          and(eq(groupingColumn, groupingId), inArray(pivot.productId, remove)),
          context,
        )
        await this.softDelete(
          leaving.map((row) => row.id),
          context,
        )
      }
    }

    /**
     * Makes `groupingIds` the product's whole set: soft-deletes the rows it drops, keeps the rest and
     * creates the new ones — the same diff the product's options use.
     */
    async replaceGroupingsOfProduct(productId: string, groupingIds: string[], context: Context): Promise<void> {
      const wanted = new Set(groupingIds)
      const existing = await this.findLive(eq(pivot.productId, productId), context)
      const existingIds = new Set(existing.map((row) => row.groupingId))

      await this.softDelete(
        existing.filter((row) => !wanted.has(row.groupingId)).map((row) => row.id),
        context,
      )
      await this.createRows(
        [...wanted]
          .filter((groupingId) => !existingIds.has(groupingId))
          .map((groupingId) => ({ productId, groupingId })),
        context,
      )
    }

    /** Every product's live groupings, sorted, in one query. A product in none maps to `[]`. */
    async findGroupingsOfProducts(productIds: string[], context?: Context): Promise<Map<string, Grouping[]>> {
      const byProduct = new Map<string, Grouping[]>(productIds.map((productId) => [productId, []]))
      if (productIds.length === 0) return byProduct

      const rows = await this.getClient(context)
        .select({ productId: pivot.productId, grouping: groupingTable })
        .from(pivotTable)
        .innerJoin(groupingTable, eq(grouping.id, groupingColumn))
        .where(and(inArray(pivot.productId, productIds), isNull(pivot.deletedAt), isNull(grouping.deletedAt)))
        .orderBy(asc(orderBy), asc(grouping.id))
      for (const row of rows as { productId: string; grouping: Grouping }[]) {
        byProduct.get(row.productId)?.push(row.grouping)
      }
      return byProduct
    }

    private async findLive(
      where: SQL | undefined,
      context?: Context,
    ): Promise<{ id: string; productId: string; groupingId: string }[]> {
      const rows = await this.getClient(context)
        .select({ id: pivot.id, productId: pivot.productId, groupingId: groupingColumn })
        .from(pivotTable)
        .where(and(where, isNull(pivot.deletedAt)))
      return rows as { id: string; productId: string; groupingId: string }[]
    }

    private async createRows(rows: { productId: string; groupingId: string }[], context?: Context): Promise<void> {
      // The pivot's insert model is `{ productId, [groupingKey] }` plus defaulted columns; TypeScript
      // cannot see that through the generic key, so the shape is asserted here, in one place.
      await this.createMany(
        rows.map(({ productId, groupingId }) => ({ productId, [groupingKey]: groupingId }) as InferInsertModel<TPivot>),
        context,
      )
    }
  }
}
