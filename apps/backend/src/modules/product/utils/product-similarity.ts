import { type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { StoreRelatedMatchDTO } from '../../../core/types/store/common.js'
import { OPTION_FILTER_PREFIX } from '../../../core/utils/product-filter-key.js'
import { productTable } from '../models/product.js'
import { productMetafieldTable } from '../models/product-metafield.js'
import { productMetafieldDefinitionTable } from '../models/product-metafield-definition.js'
import { productOptionTable } from '../models/product-option.js'
import { productOptionBucketTable } from '../models/product-option-bucket.js'
import { productOptionValueTable } from '../models/product-option-value.js'
import { productOptionValueBucketTable } from '../models/product-option-value-bucket.js'
import { productProductCategoryTable } from '../models/product-product-category.js'
import { productProductOptionTable } from '../models/product-product-option.js'
import { productProductOptionValueTable } from '../models/product-product-option-value.js'
import { optionFilterValue, optionValueBucket, optionValueInBucket } from './product-where.js'

/*
 * How much a product resembles another, as SQL over the unaliased `product` table: the sum of the
 * weights of the matches the two share. Beside `productWhere` for the same reason it is: the store
 * catalogue listing in `link-modules` ranks by it inside its one query.
 */

/** The live product whose handle is `handle`, as a scalar subquery. */
export function productIdByHandle(handle: string): SQL {
  return sql`(SELECT source.id FROM ${productTable} source WHERE source.handle = ${handle} AND source.deleted_at IS NULL)`
}

/**
 * The score of the `product` row against the product `sourceId` names: each match the two share adds
 * its weight. A key is `category` (a Category both are direct members of), `type` (the same Product
 * Type), `brand` (the same brand, ignoring case), `option.<Title>` (a value of that option both offer,
 * by bucket where it has buckets, as the store filter names it) or a field's key (a value both hold,
 * read through the field's source as the filter reads it).
 */
export function productSimilarity(sourceId: SQL, match: StoreRelatedMatchDTO[]): SQL {
  if (match.length === 0) return sql`0`
  return sql`(${sql.join(
    match.map(({ key, weight }) => sql`CASE WHEN ${shares(key, sourceId)} THEN ${weight}::int ELSE 0 END`),
    sql` + `,
  )})`
}

function shares(key: string, sourceId: SQL): SQL {
  if (key === 'category') return sharesCategory(sourceId)
  if (key === 'type') return sharesType(sourceId)
  if (key === 'brand') return sharesBrand(sourceId)
  if (key.startsWith(OPTION_FILTER_PREFIX)) return sharesOptionValue(key.slice(OPTION_FILTER_PREFIX.length), sourceId)
  return sharesField(key, sourceId)
}

function sharesCategory(sourceId: SQL): SQL {
  const pivot = productProductCategoryTable
  return sql`EXISTS (
    SELECT 1 FROM ${pivot} candidate_category
    JOIN ${pivot} source_category ON source_category.category_id = candidate_category.category_id
      AND source_category.product_id = ${sourceId} AND source_category.deleted_at IS NULL
    WHERE candidate_category.product_id = ${productTable.id} AND candidate_category.deleted_at IS NULL
  )`
}

function sharesType(sourceId: SQL): SQL {
  return sql`${productTable.typeId} = (SELECT source.type_id FROM ${productTable} source WHERE source.id = ${sourceId})`
}

function sharesBrand(sourceId: SQL): SQL {
  return sql`lower(${productTable.brand}) = (SELECT lower(source.brand) FROM ${productTable} source WHERE source.id = ${sourceId})`
}

/** The values of the live option titled `title` that `productId` offers, named as the store filter names them. */
function offeredOptionValues(title: string, productId: SQL | AnyPgColumn): SQL {
  return sql`SELECT ${optionFilterValue}
    FROM ${productProductOptionValueTable}
    JOIN ${productProductOptionTable} ON ${productProductOptionTable.id} = ${productProductOptionValueTable.productProductOptionId}
      AND ${productProductOptionTable.deletedAt} IS NULL
    JOIN ${productOptionTable} ON ${productOptionTable.id} = ${productProductOptionTable.optionId}
      AND ${productOptionTable.deletedAt} IS NULL AND ${productOptionTable.title} = ${title}
    JOIN ${productOptionValueTable} ON ${productOptionValueTable.id} = ${productProductOptionValueTable.optionValueId}
      AND ${productOptionValueTable.deletedAt} IS NULL
    LEFT JOIN ${productOptionValueBucketTable} ON ${optionValueInBucket}
    LEFT JOIN ${productOptionBucketTable} ON ${optionValueBucket}
    WHERE ${productProductOptionTable.productId} = ${productId} AND ${productProductOptionValueTable.deletedAt} IS NULL`
}

function sharesOptionValue(title: string, sourceId: SQL): SQL {
  return sql`EXISTS (${offeredOptionValues(title, productTable.id)} INTERSECT ${offeredOptionValues(title, sourceId)})`
}

/** A value of the field `key` both hold, through the live definition's source, as `holdsMetafield` reads it. */
function sharesField(key: string, sourceId: SQL): SQL {
  const definition = productMetafieldDefinitionTable
  const metafield = productMetafieldTable
  return sql`EXISTS (
    SELECT 1 FROM ${definition}
    WHERE ${definition.key} = ${key} AND ${definition.deletedAt} IS NULL AND (
      (${definition.source} = 'metafield' AND EXISTS (
        SELECT 1 FROM ${metafield} candidate_value
        JOIN ${metafield} source_value ON source_value.definition_id = candidate_value.definition_id
          AND source_value.value = candidate_value.value
          AND source_value.product_id = ${sourceId} AND source_value.deleted_at IS NULL
        WHERE candidate_value.definition_id = ${definition.id}
          AND candidate_value.product_id = ${productTable.id} AND candidate_value.deleted_at IS NULL
      ))
      OR (${definition.source} = 'vendor' AND ${sharesBrand(sourceId)})
      OR (${definition.source} = 'type' AND ${sharesType(sourceId)})
    )
  )`
}
