import { and, asc, eq, exists, inArray, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { Context } from '../../../core/types/context.js'
import type {
  FilterableProductProps,
  ProductMetafieldDefinitionDTO,
  ProductMetafieldFilterValueDTO,
} from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productTable } from '../models/product.js'
import { productCollectionTable } from '../models/product-collection.js'
import { productMetafieldTable } from '../models/product-metafield.js'
import { productMetafieldDefinitionTable } from '../models/product-metafield-definition.js'
import { productProductCategoryTable } from '../models/product-product-category.js'
import { productProductCollectionTable } from '../models/product-product-collection.js'
import { productProductTagTable } from '../models/product-product-tag.js'
import { productTagTable } from '../models/product-tag.js'
import { visibleCategoriesQuery } from './product-category.js'

const asArray = (value: string | string[]) => (Array.isArray(value) ? value : [value])

const collectionPivot = {
  pivot: productProductCollectionTable,
  groupingColumn: productProductCollectionTable.collectionId,
  grouping: productCollectionTable,
}
const tagPivot = {
  pivot: productProductTagTable,
  groupingColumn: productProductTagTable.tagId,
  grouping: productTagTable,
}

export class ProductRepository extends BaseRepository(productTable) {
  async findByHandle(handle: string, context?: Context) {
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(this.table)
      .where(and(eq(this.table.handle, handle), isNull(this.table.deletedAt)))
    return rows[0] ?? null
  }

  /**
   * The distinct live Tag values on the products `filters` match, sorted. The product filters are the
   * list's own `WHERE`, so the values follow every scope the list does.
   */
  async findTagValues(filters: FilterableProductProps, context?: Context): Promise<string[]> {
    const client = this.getClient(context)
    const rows = await client
      .selectDistinct({ value: productTagTable.value })
      .from(productTagTable)
      .innerJoin(productProductTagTable, eq(productProductTagTable.tagId, productTagTable.id))
      .innerJoin(this.table, eq(this.table.id, productProductTagTable.productId))
      .where(and(isNull(productTagTable.deletedAt), isNull(productProductTagTable.deletedAt), this.buildWhere(filters)))
      .orderBy(asc(productTagTable.value))
    return rows.map((row) => row.value)
  }

  /**
   * Every live value of `definition` on the products `filters` match, sorted, each with how many of
   * them would remain once it is chosen — standard facet counting. The values are those of the list
   * before any selection, so a value nothing in view would keep still comes back, at 0; the count
   * applies every selection but this definition's own, because choosing a value widens its own key
   * (values OR) and narrows only through the others (keys AND). The Tag selection counts as one of
   * the others. One `GROUP BY` over the definition's values; for the vendor field, over the brands,
   * spellings that differ only in case being one value under the most used one.
   */
  async findMetafieldValueCounts(
    definition: Pick<ProductMetafieldDefinitionDTO, 'id' | 'key' | 'source'>,
    { tagValue, metafields, ...scope }: FilterableProductProps,
    context?: Context,
  ): Promise<ProductMetafieldFilterValueDTO[]> {
    const { [definition.key]: _own, ...otherMetafields } = metafields ?? {}
    const narrowed = this.extraWhere({ tagValue, metafields: otherMetafields }) ?? sql`TRUE`
    const count = sql<number>`COUNT(DISTINCT ${this.table.id}) FILTER (WHERE ${narrowed})`.mapWith(Number)
    const client = this.getClient(context)
    if (definition.source === 'vendor') {
      // The spelling most of the products use stands for the value.
      const brand = sql<string>`mode() WITHIN GROUP (ORDER BY ${this.table.brand})`
      return client
        .select({ value: brand, count })
        .from(this.table)
        .where(and(isNotNull(this.table.brand), this.buildWhere(scope)))
        .groupBy(sql`lower(${this.table.brand})`)
        .orderBy(asc(brand))
    }
    return client
      .select({
        value: productMetafieldTable.value,
        count,
      })
      .from(productMetafieldTable)
      .innerJoin(this.table, eq(this.table.id, productMetafieldTable.productId))
      .where(
        and(
          eq(productMetafieldTable.definitionId, definition.id),
          isNull(productMetafieldTable.deletedAt),
          this.buildWhere(scope),
        ),
      )
      .groupBy(productMetafieldTable.value)
      .orderBy(asc(productMetafieldTable.value))
  }

  /** The grouping filters: each one an `EXISTS`, ANDed with the column filters and each other. */
  protected override extraWhere(filters?: FilterableProductProps): SQL | undefined {
    if (!filters) return undefined
    const {
      categoryId,
      categoryHandle,
      collectionId,
      collectionHandle,
      tagId,
      tagValue,
      metafields = {},
      includeDescendants = false,
      visibleOnly = false,
    } = filters
    const clauses: SQL[] = []
    const scope = { includeDescendants, visibleOnly }
    if (categoryId !== undefined) clauses.push(this.inCategories(sql`id`, asArray(categoryId), scope))
    if (categoryHandle !== undefined) clauses.push(this.inCategories(sql`handle`, asArray(categoryHandle), scope))
    if (collectionId !== undefined)
      clauses.push(this.inGroupings(collectionPivot, productCollectionTable.id, collectionId))
    if (collectionHandle !== undefined) {
      clauses.push(this.inGroupings(collectionPivot, productCollectionTable.handle, collectionHandle))
    }
    if (tagId !== undefined) clauses.push(this.inGroupings(tagPivot, productTagTable.id, tagId))
    if (tagValue !== undefined) clauses.push(this.inGroupings(tagPivot, productTagTable.value, tagValue))
    for (const [key, values] of Object.entries(metafields)) {
      if (values.length > 0) clauses.push(this.holdsMetafield(key, values))
    }
    return clauses.length > 0 ? and(...clauses) : undefined
  }

  /**
   * Members of the Categories whose `column` is one of `values`. Direct members only by default — a
   * product in a child Category is not in its parent — and widened to the matched Categories'
   * subtrees by `includeDescendants`. `visibleOnly` walks the Visible tree instead of every live
   * Category, so a hidden Category, or one under a hidden ancestor, matches nothing.
   */
  private inCategories(
    column: SQL,
    values: string[],
    { includeDescendants, visibleOnly }: { includeDescendants: boolean; visibleOnly: boolean },
  ): SQL {
    const pool = visibleOnly
      ? sql`visible_category AS (${visibleCategoriesQuery}), category_pool AS (SELECT * FROM visible_category)`
      : sql`category_pool AS (SELECT id, parent_id, handle FROM product_category WHERE deleted_at IS NULL)`
    const descendants = includeDescendants
      ? sql`UNION ALL SELECT child.id FROM category_pool child JOIN matched_category parent ON child.parent_id = parent.id`
      : sql``
    const matchedValues = sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )
    return sql`EXISTS (
      WITH RECURSIVE ${pool},
      matched_category AS (
        SELECT id FROM category_pool WHERE ${column} IN (${matchedValues})
        ${descendants}
      )
      SELECT 1 FROM ${productProductCategoryTable}
      WHERE ${productProductCategoryTable.productId} = ${this.table.id}
        AND ${productProductCategoryTable.deletedAt} IS NULL
        AND ${productProductCategoryTable.categoryId} IN (SELECT id FROM matched_category)
    )`
  }

  /**
   * Members of the live groupings — Collections or Tags — whose `column` is one of `values`. Both the
   * pivot row and the grouping must be live.
   */
  private inGroupings(
    { pivot, groupingColumn, grouping }: typeof collectionPivot | typeof tagPivot,
    column: AnyPgColumn,
    values: string | string[],
  ): SQL {
    const client = this.getClient()
    return exists(
      client
        .select({ id: pivot.id })
        .from(pivot)
        .innerJoin(grouping, eq(grouping.id, groupingColumn))
        .where(
          and(
            eq(pivot.productId, this.table.id),
            inArray(column, asArray(values)),
            isNull(pivot.deletedAt),
            isNull(grouping.deletedAt),
          ),
        ),
    )
  }

  /**
   * Products whose field `key` holds any of `values`, under a live definition: a metafield's live
   * values exactly, or the vendor field's brand ignoring case.
   */
  private holdsMetafield(key: string, values: string[]): SQL {
    const client = this.getClient()
    const heldMetafield = exists(
      client
        .select({ id: productMetafieldTable.id })
        .from(productMetafieldTable)
        .where(
          and(
            eq(productMetafieldTable.productId, this.table.id),
            eq(productMetafieldTable.definitionId, productMetafieldDefinitionTable.id),
            inArray(productMetafieldTable.value, values),
            isNull(productMetafieldTable.deletedAt),
          ),
        ),
    )
    const heldBrand = inArray(
      sql`lower(${this.table.brand})`,
      values.map((value) => value.toLowerCase()),
    )
    return exists(
      client
        .select({ id: productMetafieldDefinitionTable.id })
        .from(productMetafieldDefinitionTable)
        .where(
          and(
            eq(productMetafieldDefinitionTable.key, key),
            isNull(productMetafieldDefinitionTable.deletedAt),
            or(
              and(eq(productMetafieldDefinitionTable.source, 'metafield'), heldMetafield),
              and(eq(productMetafieldDefinitionTable.source, 'vendor'), heldBrand),
            ),
          ),
        ),
    )
  }
}
