import { and, type Column, eq, exists, getTableColumns, inArray, isNull, or, type SQL, sql } from 'drizzle-orm'
import { type AnyPgColumn, QueryBuilder } from 'drizzle-orm/pg-core'
import type { FilterableProductProps } from '../../../core/types/product/common.js'
import { buildFilters, type FilterRecord } from '../../../core/utils/build-filters.js'
import { productTable } from '../models/product.js'
import { productCollectionTable } from '../models/product-collection.js'
import { productMetafieldTable } from '../models/product-metafield.js'
import { productMetafieldDefinitionTable } from '../models/product-metafield-definition.js'
import { productOptionTable } from '../models/product-option.js'
import { productOptionBucketTable } from '../models/product-option-bucket.js'
import { productOptionValueTable } from '../models/product-option-value.js'
import { productProductCategoryTable } from '../models/product-product-category.js'
import { productProductCollectionTable } from '../models/product-product-collection.js'
import { productProductOptionTable } from '../models/product-product-option.js'
import { productProductOptionValueTable } from '../models/product-product-option-value.js'
import { productProductTagTable } from '../models/product-product-tag.js'
import { productTagTable } from '../models/product-tag.js'
import { productTypeTable } from '../models/product-type.js'

/*
 * Which products a `FilterableProductProps` matches, as SQL over the unaliased `product` table.
 *
 * Pure SQL builders rather than repository methods, because two readers need the same `WHERE`: the
 * product repository, and the store catalogue listing in `link-modules`, which joins product to
 * pricing and inventory in one query and must narrow it exactly as the product list would. A copy in
 * each would drift the first time a grouping filter changed.
 */

/** Builds the `EXISTS` subqueries without a connection: they are SQL, run by whichever query holds them. */
const queryBuilder = new QueryBuilder()

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

/**
 * The Visible rule as a recursive CTE body, which must be embedded as `visible_category`: active, not
 * internal, and every ancestor visible — walked down from the roots, so a hidden Category stops the
 * walk and its whole subtree stays out. Every level filters `deleted_at` by hand.
 */
export const visibleCategoriesQuery: SQL = sql`
  SELECT id, parent_id, handle FROM product_category
  WHERE parent_id IS NULL AND is_active AND NOT is_internal AND deleted_at IS NULL
  UNION ALL
  SELECT child.id, child.parent_id, child.handle FROM product_category child
  JOIN visible_category parent ON child.parent_id = parent.id
  WHERE child.is_active AND NOT child.is_internal AND child.deleted_at IS NULL
`

/** The whole match — live, the column filters and the grouping filters — as `ProductRepository.find` applies it. */
export function productWhere(filters: FilterableProductProps): SQL {
  const columnFilters = buildFilters(
    filters as FilterRecord,
    getTableColumns(productTable) as unknown as Record<string, Column>,
  )
  const parts = [isNull(productTable.deletedAt), columnFilters, productGroupingWhere(filters)]
  return and(...parts.filter((part): part is SQL => part !== undefined)) ?? sql`TRUE`
}

/** The grouping filters: each one an `EXISTS` or an `IN`, ANDed with each other. */
export function productGroupingWhere(filters?: FilterableProductProps): SQL | undefined {
  if (!filters) return undefined
  const {
    categoryId,
    categoryHandle,
    collectionId,
    collectionHandle,
    tagId,
    tagValue,
    metafields = {},
    optionValues = {},
    sellableProductIds,
    selectedProductIds,
    includeDescendants = false,
    visibleOnly = false,
  } = filters
  const clauses: SQL[] = []
  const scope = { includeDescendants, visibleOnly }
  if (categoryId !== undefined) clauses.push(inCategories(sql`id`, asArray(categoryId), scope))
  if (categoryHandle !== undefined) clauses.push(inCategories(sql`handle`, asArray(categoryHandle), scope))
  if (collectionId !== undefined) clauses.push(inGroupings(collectionPivot, productCollectionTable.id, collectionId))
  if (collectionHandle !== undefined) {
    clauses.push(inGroupings(collectionPivot, productCollectionTable.handle, collectionHandle))
  }
  if (tagId !== undefined) clauses.push(inGroupings(tagPivot, productTagTable.id, tagId))
  if (tagValue !== undefined) clauses.push(inGroupings(tagPivot, productTagTable.value, tagValue))
  for (const [key, values] of Object.entries(metafields)) {
    if (values.length > 0) clauses.push(holdsMetafield(key, values))
  }
  for (const [title, values] of Object.entries(optionValues)) {
    if (values.length > 0) clauses.push(offersOptionValue(title, values))
  }
  if (sellableProductIds !== undefined) clauses.push(sql`${productTable.id} IN (${sellableProductIds})`)
  if (selectedProductIds !== undefined) clauses.push(sql`${productTable.id} IN (${selectedProductIds})`)
  return clauses.length > 0 ? and(...clauses) : undefined
}

/**
 * Members of the Categories whose `column` is one of `values`. Direct members only by default — a
 * product in a child Category is not in its parent — and widened to the matched Categories'
 * subtrees by `includeDescendants`. `visibleOnly` walks the Visible tree instead of every live
 * Category, so a hidden Category, or one under a hidden ancestor, matches nothing.
 */
function inCategories(
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
    WHERE ${productProductCategoryTable.productId} = ${productTable.id}
      AND ${productProductCategoryTable.deletedAt} IS NULL
      AND ${productProductCategoryTable.categoryId} IN (SELECT id FROM matched_category)
  )`
}

/**
 * Members of the live groupings — Collections or Tags — whose `column` is one of `values`. Both the
 * pivot row and the grouping must be live.
 */
function inGroupings(
  { pivot, groupingColumn, grouping }: typeof collectionPivot | typeof tagPivot,
  column: AnyPgColumn,
  values: string | string[],
): SQL {
  return exists(
    queryBuilder
      .select({ id: pivot.id })
      .from(pivot)
      .innerJoin(grouping, eq(grouping.id, groupingColumn))
      .where(
        and(
          eq(pivot.productId, productTable.id),
          inArray(column, asArray(values)),
          isNull(pivot.deletedAt),
          isNull(grouping.deletedAt),
        ),
      ),
  )
}

/**
 * What the store filter calls an option value: its bucket's name when the value is in a live bucket,
 * else the value itself. For a `FROM` that left-joins {@link productOptionBucketTable} on the value.
 */
export const optionFilterValue = sql<string>`COALESCE(${productOptionBucketTable.name}, ${productOptionValueTable.value})`

/** The live bucket of the joined option value, for a left join. */
export const optionValueBucket = and(
  eq(productOptionBucketTable.id, productOptionValueTable.bucketId),
  isNull(productOptionBucketTable.deletedAt),
)

/** Products offering any of `values` of the live option titled `title`, by bucket name where it has buckets. */
function offersOptionValue(title: string, values: string[]): SQL {
  return exists(
    queryBuilder
      .select({ id: productProductOptionValueTable.id })
      .from(productProductOptionValueTable)
      .innerJoin(
        productProductOptionTable,
        eq(productProductOptionTable.id, productProductOptionValueTable.productProductOptionId),
      )
      .innerJoin(productOptionTable, eq(productOptionTable.id, productProductOptionTable.optionId))
      .innerJoin(productOptionValueTable, eq(productOptionValueTable.id, productProductOptionValueTable.optionValueId))
      .leftJoin(productOptionBucketTable, optionValueBucket)
      .where(
        and(
          eq(productProductOptionTable.productId, productTable.id),
          eq(productOptionTable.title, title),
          inArray(optionFilterValue, values),
          isNull(productProductOptionValueTable.deletedAt),
          isNull(productProductOptionTable.deletedAt),
          isNull(productOptionTable.deletedAt),
          isNull(productOptionValueTable.deletedAt),
        ),
      ),
  )
}

/**
 * Products whose field `key` holds any of `values`, under a live definition: a metafield's live
 * values exactly, or the vendor field's brand or the type field's Product Type ignoring case.
 */
function holdsMetafield(key: string, values: string[]): SQL {
  const heldMetafield = exists(
    queryBuilder
      .select({ id: productMetafieldTable.id })
      .from(productMetafieldTable)
      .where(
        and(
          eq(productMetafieldTable.productId, productTable.id),
          eq(productMetafieldTable.definitionId, productMetafieldDefinitionTable.id),
          inArray(productMetafieldTable.value, values),
          isNull(productMetafieldTable.deletedAt),
        ),
      ),
  )
  const lowered = values.map((value) => value.toLowerCase())
  const heldBrand = inArray(sql`lower(${productTable.brand})`, lowered)
  const heldType = exists(
    queryBuilder
      .select({ id: productTypeTable.id })
      .from(productTypeTable)
      .where(
        and(
          eq(productTypeTable.id, productTable.typeId),
          inArray(sql`lower(${productTypeTable.value})`, lowered),
          isNull(productTypeTable.deletedAt),
        ),
      ),
  )
  return exists(
    queryBuilder
      .select({ id: productMetafieldDefinitionTable.id })
      .from(productMetafieldDefinitionTable)
      .where(
        and(
          eq(productMetafieldDefinitionTable.key, key),
          isNull(productMetafieldDefinitionTable.deletedAt),
          or(
            and(eq(productMetafieldDefinitionTable.source, 'metafield'), heldMetafield),
            and(eq(productMetafieldDefinitionTable.source, 'vendor'), heldBrand),
            and(eq(productMetafieldDefinitionTable.source, 'type'), heldType),
          ),
        ),
      ),
  )
}
