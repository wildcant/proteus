import { and, asc, eq, isNotNull, isNull, type SQL, sql } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type {
  FilterableProductProps,
  ProductFieldGroupDTO,
  ProductFilterValueDTO,
  ProductMetafieldDefinitionDTO,
} from '../../../core/types/product/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productTable } from '../models/product.js'
import { productMetafieldTable } from '../models/product-metafield.js'
import { productOptionTable } from '../models/product-option.js'
import { productOptionBucketTable } from '../models/product-option-bucket.js'
import { productOptionValueTable } from '../models/product-option-value.js'
import { productOptionValueBucketTable } from '../models/product-option-value-bucket.js'
import { productProductOptionTable } from '../models/product-product-option.js'
import { productProductOptionValueTable } from '../models/product-product-option-value.js'
import { productProductTagTable } from '../models/product-product-tag.js'
import { productTagTable } from '../models/product-tag.js'
import { productTypeTable } from '../models/product-type.js'
import {
  optionFilterValue,
  optionValueBucket,
  optionValueInBucket,
  productGroupingWhere,
} from '../utils/product-where.js'

export class ProductRepository extends BaseRepository(productTable) {
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
   * the others. One `GROUP BY` over the definition's values; for the vendor field over the brands,
   * and for the type field over the Product Types, spellings that differ only in case being one
   * value under the most used one.
   */
  async findMetafieldValueCounts(
    definition: Pick<ProductMetafieldDefinitionDTO, 'id' | 'key' | 'source'>,
    { tagValue, metafields, optionValues, selectedProductIds, ...scope }: FilterableProductProps,
    context?: Context,
  ): Promise<ProductFilterValueDTO[]> {
    const { [definition.key]: _own, ...otherMetafields } = metafields ?? {}
    const narrowed =
      this.extraWhere({ tagValue, optionValues, selectedProductIds, metafields: otherMetafields }) ?? sql`TRUE`
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
    if (definition.source === 'type') {
      const type = sql<string>`mode() WITHIN GROUP (ORDER BY ${productTypeTable.value})`
      return client
        .select({ value: type, count })
        .from(this.table)
        .innerJoin(
          productTypeTable,
          and(eq(productTypeTable.id, this.table.typeId), isNull(productTypeTable.deletedAt)),
        )
        .where(this.buildWhere(scope))
        .groupBy(sql`lower(${productTypeTable.value})`)
        .orderBy(asc(type))
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

  /**
   * The values of `definition` on the products `filters` match, grouped by `groupDefinition`'s, each
   * group and each value with how many products hold it, both most products first and then
   * alphabetically. Brands and Product Types group ignoring case, under their most used spelling.
   */
  async findFieldGroupCounts(
    definition: Pick<ProductMetafieldDefinitionDTO, 'id' | 'source'>,
    groupDefinition: Pick<ProductMetafieldDefinitionDTO, 'id' | 'source'>,
    filters: FilterableProductProps,
    context?: Context,
  ): Promise<ProductFieldGroupDTO[]> {
    const values = this.fieldValuesOf(definition)
    const groups = this.fieldValuesOf(groupDefinition)
    const where = this.buildWhere(filters) ?? sql`TRUE`
    const count = sql<number>`COUNT(DISTINCT ${this.table.id})`.mapWith(Number)
    const client = this.getClient(context)
    const [groupRows, valueRows] = await Promise.all([
      client
        .select({
          identity: sql<string>`g.identity`,
          value: sql<string>`mode() WITHIN GROUP (ORDER BY g.value)`,
          count,
        })
        .from(this.table)
        .innerJoin(sql`(${groups}) g`, sql`g.product_id = ${this.table.id}`)
        .where(where)
        .groupBy(sql`g.identity`),
      client
        .select({
          groupIdentity: sql<string>`g.identity`,
          value: sql<string>`mode() WITHIN GROUP (ORDER BY v.value)`,
          count,
        })
        .from(this.table)
        .innerJoin(sql`(${groups}) g`, sql`g.product_id = ${this.table.id}`)
        .innerJoin(sql`(${values}) v`, sql`v.product_id = ${this.table.id}`)
        .where(where)
        .groupBy(sql`g.identity`, sql`v.identity`),
    ])
    const mostFirst = (a: ProductFilterValueDTO, b: ProductFilterValueDTO) =>
      b.count - a.count || a.value.localeCompare(b.value)
    return groupRows
      .map(({ identity, value, count: groupCount }) => ({
        value,
        count: groupCount,
        values: valueRows
          .filter((row) => row.groupIdentity === identity)
          .map((row) => ({ value: row.value, count: row.count }))
          .sort(mostFirst),
      }))
      .sort(mostFirst)
  }

  /**
   * A field's values as rows of `product_id`, `value` and `identity`, the value two spellings share:
   * a metafield's live values as written, the brand or the Product Type lowercased.
   */
  private fieldValuesOf(definition: Pick<ProductMetafieldDefinitionDTO, 'id' | 'source'>): SQL {
    if (definition.source === 'vendor') {
      return sql`SELECT ${productTable.id} AS product_id, ${productTable.brand} AS value, lower(${productTable.brand}) AS identity
        FROM ${productTable} WHERE ${productTable.brand} IS NOT NULL`
    }
    if (definition.source === 'type') {
      return sql`SELECT ${productTable.id} AS product_id, ${productTypeTable.value} AS value, lower(${productTypeTable.value}) AS identity
        FROM ${productTable} JOIN ${productTypeTable} ON ${productTypeTable.id} = ${productTable.typeId}
        WHERE ${productTypeTable.deletedAt} IS NULL`
    }
    return sql`SELECT ${productMetafieldTable.productId} AS product_id, ${productMetafieldTable.value} AS value, ${productMetafieldTable.value} AS identity
      FROM ${productMetafieldTable}
      WHERE ${productMetafieldTable.definitionId} = ${definition.id} AND ${productMetafieldTable.deletedAt} IS NULL`
  }

  /** The options the products `filters` match offer, by title. Only `filters`' scope applies: its selections narrow counts, not this. */
  async findOfferedOptions(
    {
      tagValue: _tag,
      metafields: _metafields,
      optionValues: _options,
      selectedProductIds: _selected,
      ...scope
    }: FilterableProductProps,
    context?: Context,
  ): Promise<Array<{ id: string; title: string }>> {
    const client = this.getClient(context)
    return client
      .selectDistinct({ id: productOptionTable.id, title: productOptionTable.title })
      .from(productProductOptionTable)
      .innerJoin(productOptionTable, eq(productOptionTable.id, productProductOptionTable.optionId))
      .innerJoin(this.table, eq(this.table.id, productProductOptionTable.productId))
      .where(
        and(isNull(productProductOptionTable.deletedAt), isNull(productOptionTable.deletedAt), this.buildWhere(scope)),
      )
      .orderBy(asc(productOptionTable.title))
  }

  /**
   * Every value of `option` the products `filters` match offer, in the option's own order, numbers by
   * value where that order ties (sizes small to large), each with how many would remain once it is chosen — counted as
   * `findMetafieldValueCounts` counts, every selection applying but this option's own.
   */
  async findOptionValueCounts(
    option: { id: string; title: string },
    { tagValue, metafields, optionValues, selectedProductIds, ...scope }: FilterableProductProps,
    context?: Context,
  ): Promise<ProductFilterValueDTO[]> {
    const { [option.title]: _own, ...otherOptions } = optionValues ?? {}
    const narrowed =
      this.extraWhere({ tagValue, metafields, selectedProductIds, optionValues: otherOptions }) ?? sql`TRUE`
    const client = this.getClient(context)
    return (
      client
        .select({
          value: optionFilterValue,
          count: sql<number>`COUNT(DISTINCT ${this.table.id}) FILTER (WHERE ${narrowed})`.mapWith(Number),
          swatch: sql<string | null>`MIN(${productOptionBucketTable.swatch})`,
        })
        .from(productProductOptionValueTable)
        .innerJoin(
          productProductOptionTable,
          eq(productProductOptionTable.id, productProductOptionValueTable.productProductOptionId),
        )
        .innerJoin(
          productOptionValueTable,
          eq(productOptionValueTable.id, productProductOptionValueTable.optionValueId),
        )
        .leftJoin(productOptionValueBucketTable, optionValueInBucket)
        .leftJoin(productOptionBucketTable, optionValueBucket)
        .innerJoin(this.table, eq(this.table.id, productProductOptionTable.productId))
        .where(
          and(
            eq(productProductOptionTable.optionId, option.id),
            isNull(productProductOptionValueTable.deletedAt),
            isNull(productProductOptionTable.deletedAt),
            isNull(productOptionValueTable.deletedAt),
            this.buildWhere(scope),
          ),
        )
        // A bucketed value counts as each of its buckets, so "Black / Red" and "Jet Black" are one "Black",
        // and "Black / Red" is a "Red" too. `COUNT(DISTINCT)` counts a product once per bucket it reaches.
        .groupBy(optionFilterValue)
        // The buckets' or the option's own order first; values it leaves tied go by number when they are
        // numbers, so a size 9 comes before 10, and by text otherwise.
        .orderBy(
          sql`MIN(COALESCE(${productOptionBucketTable.rank}, ${productOptionValueTable.rank}))`,
          sql`CASE WHEN ${optionFilterValue} ~ '^[0-9]+([.,][0-9]+)?$' THEN replace(${optionFilterValue}, ',', '.')::numeric END NULLS LAST`,
          asc(optionFilterValue),
        )
    )
  }

  /**
   * The word of the matched products' titles and brands most like `word` by trigram similarity
   * (`pg_trgm`), when one scores above `threshold`: the words a search matches, so "jordna" finds the
   * brand Jordan though no title holds it. Words are lower-cased and split at spaces and punctuation,
   * so "Air Force 1" offers `air`, `force` and `1`. Ties go to the alphabetically first word, so one
   * search always corrects the same way.
   */
  async findClosestSearchWord(
    word: string,
    filters: FilterableProductProps,
    threshold: number,
    context?: Context,
  ): Promise<string | null> {
    const client = this.getClient(context)
    const searchWords = client
      .selectDistinct({
        word: sql<string>`lower(regexp_split_to_table(concat_ws(' ', ${this.table.title}, ${this.table.brand}), '[[:space:][:punct:]]+'))`.as(
          'word',
        ),
      })
      .from(this.table)
      .where(this.buildWhere(filters))
      .as('search_word')
    const similarity = sql`similarity(${searchWords.word}, ${word})`
    const [closest] = await client
      .select({ word: searchWords.word })
      .from(searchWords)
      .where(and(sql`${searchWords.word} <> ''`, sql`${similarity} > ${threshold}`))
      .orderBy(sql`${similarity} DESC`, asc(searchWords.word))
      .limit(1)
    return closest?.word ?? null
  }

  /** The grouping filters, shared with the store catalogue listing so both narrow alike. */
  protected override extraWhere(filters?: FilterableProductProps): SQL | undefined {
    return productGroupingWhere(filters)
  }
}
