import { type SQL, sql } from 'drizzle-orm'
import { BigNumber } from '../../core/bignumber.js'
import type { Context } from '../../core/types/context.js'
import type {
  ListStoreFacetsOptions,
  ListStoreProductsOptions,
  StoreCatalogFilters,
  StoreFacetsDTO,
  StoreListedProductDTO,
  StoreProductSort,
} from '../../core/types/link/common.js'
import type { FilterableProductProps } from '../../core/types/product/common.js'
import { buildSearchFilter, PRODUCT_SEARCH_COLUMNS } from '../../core/utils/build-search-filter.js'
import type { Database } from '../../schema.type.js'
import { productVariantInventoryItemTable } from '../definitions/product-variant-inventory-item.js'
import { productVariantPriceSetTable } from '../definitions/product-variant-price-set.js'
import {
  inventoryLevelTable,
  optionFilterValue,
  optionValueBucket,
  optionValueInBucket,
  priceTable,
  productIdByHandle,
  productOptionBucketTable,
  productOptionTable,
  productOptionValueBucketTable,
  productOptionValueTable,
  productProductOptionTable,
  productProductOptionValueTable,
  productSimilarity,
  productTable,
  productVariantOptionTable,
  productVariantTable,
  productWhere,
} from '../modules-definitions.js'

type PriceRange = StoreCatalogFilters['priceRange']

/** Splits text into the words a search reads, as `findClosestSearchWord` and the relevance score do. */
const WORD_SEPARATOR = '[[:space:][:punct:]]+'

/**
 * The store's product list and its facets, read in one query each across product, pricing and
 * inventory — the ADR 0004 escape hatch, as `listVariantStockAndCount` is for the shop's stock.
 *
 * Price and stock decide what the list holds and in what order, and neither is a product column:
 * the price is a row in `price` reached through the variant's price set, the stock a sum over
 * Inventory Levels. Asking each module in turn means reading every variant in the catalogue to
 * learn which products to show, and paging in memory. Joined here, Postgres filters, sorts, pages
 * and counts, and the route reads only the page.
 *
 * The product module's own `WHERE` (`productWhere`) narrows the `product` rows, so a grouping
 * filter or a search matches here exactly what the product list would.
 *
 * Readonly: no table of its own.
 */
export class StoreCatalogListingRepository {
  #getDb: () => Database

  constructor({ getDb }: { getDb: () => Database }) {
    this.#getDb = getDb
  }

  private getClient(context?: Context): Database {
    return (context?.transaction as Database) ?? this.#getDb()
  }

  sellableProductIds({ currencyCode, priceRange }: Pick<StoreCatalogFilters, 'currencyCode' | 'priceRange'>): SQL {
    const { minPrice, maxPrice } = priceRange ?? {}
    // Plain joins rather than a correlated `EXISTS` per variant, so the planner can hash the whole set.
    return sql`SELECT ${productVariantTable.productId} FROM ${productVariantTable}
      JOIN ${productTable} ON ${productTable.id} = ${productVariantTable.productId}
        AND ${productTable.deletedAt} IS NULL AND ${productTable.status} = 'published'
      JOIN ${productVariantPriceSetTable} ON ${productVariantPriceSetTable.variantId} = ${productVariantTable.id}
        AND ${productVariantPriceSetTable.deletedAt} IS NULL
      JOIN ${priceTable} ON ${priceTable.priceSetId} = ${productVariantPriceSetTable.priceSetId}
        AND ${priceTable.currencyCode} = ${currencyCode}
        AND ${priceTable.deletedAt} IS NULL
      WHERE ${productVariantTable.deletedAt} IS NULL
        ${minPrice === undefined ? sql`` : sql`AND ${priceTable.amount} >= ${minPrice}`}
        ${maxPrice === undefined ? sql`` : sql`AND ${priceTable.amount} <= ${maxPrice}`}`
  }

  /**
   * One page of the store list, in the shopper's order, with the total it was cut from.
   *
   * Every product published with a variant priced in the market, narrowed by the product filters,
   * the search, and the price range (any one priced variant inside it). The
   * starting price is the cheapest priced variant's; whether the product can be bought is read for
   * the page only, after the cut, since a card the shopper will never reach needs no stock — unless
   * `purchasableOnly` asks for buyable products alone. `similarTo` ranks by likeness to one product first.
   *
   * Every order ends newest first and then by id, so rows the order cannot tell apart keep one total
   * order and an offset pager never repeats a row across pages.
   *
   * The sale price is read for the page alone too: the cheapest variant a shopper can buy now that is
   * marked down, so a cheaper variant at full price does not hide the markdown.
   */
  async listStoreProducts(
    options: ListStoreProductsOptions,
    context?: Context,
  ): Promise<{ rows: StoreListedProductDTO[]; count: number }> {
    const client = this.getClient(context)
    const { limit, offset } = options
    const order = this.rankedOrder(options)

    const listed = sql`
      SELECT ${productTable.id} AS product_id,
        (array_agg(priced_variant.price_set_id ORDER BY priced_variant.amount, priced_variant.variant_id))[1] AS starting_price_set_id,
        row_number() OVER (ORDER BY ${order}) AS ordinal,
        COUNT(*) OVER () AS total
      FROM ${productTable}
      JOIN (${this.pricedVariants(options.currencyCode)}) priced_variant ON priced_variant.product_id = ${productTable.id}
      WHERE ${this.listWhere(options)}
      GROUP BY ${productTable.id}
      ${this.inPriceRange(options.priceRange)}
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${offset}`

    const rows = await client.execute<{
      productId: string
      startingPriceSetId: string
      saleVariantId: string | null
      purchasable: boolean
      total: string
    }>(sql`
      SELECT page.product_id AS "productId", page.starting_price_set_id AS "startingPriceSetId", page.total,
        ${this.saleVariantId(options.currencyCode, sql`page.product_id`)} AS "saleVariantId",
        ${this.hasPurchasableVariant(options.currencyCode, sql`page.product_id`)} AS purchasable
      FROM (${listed}) page
      ORDER BY page.ordinal`)

    const [first] = rows
    // A page past the end holds no row to carry the total, so it is counted on its own.
    const count = first ? Number(first.total) : offset > 0 ? await this.countListed(options, context) : 0

    return {
      rows: rows.map((row) => ({
        productId: row.productId,
        startingPriceSetId: row.startingPriceSetId,
        saleVariantId: row.saleVariantId,
        purchasable: row.purchasable,
      })),
      count,
    }
  }

  /**
   * The parts of the store filters that read price or stock, over the list's scope:
   *
   * - the price slider's bounds, over every priced variant in scope;
   * - the option values a shopper can still buy — some purchasable priced variant in scope carries
   *   them — so a size nothing in view has left is drawn sold out. A bucketed value is named by its
   *   bucket, as the option's facet counts it.
   */
  async listStoreFacets(options: ListStoreFacetsOptions, context?: Context): Promise<StoreFacetsDTO> {
    const client = this.getClient(context)
    const { currencyCode } = options
    const scope = this.scopeWhere(options.products, options.search)
    const pricedVariants = this.pricedVariants(currencyCode)

    const boundsQuery = client.execute<{ min: string | null; max: string | null }>(sql`
      SELECT MIN(priced_variant.amount)::text AS min, MAX(priced_variant.amount)::text AS max
      FROM ${productTable}
      JOIN (${pricedVariants}) priced_variant ON priced_variant.product_id = ${productTable.id}
      WHERE ${scope}`)

    const inStockQuery = client.execute<{ optionTitle: string; value: string }>(sql`
      SELECT DISTINCT ${productOptionTable.title} AS "optionTitle", ${optionFilterValue} AS value
      FROM ${productTable}
      JOIN (${pricedVariants}) priced_variant ON priced_variant.product_id = ${productTable.id}
      JOIN ${productVariantOptionTable} ON ${productVariantOptionTable.variantId} = priced_variant.variant_id
        AND ${productVariantOptionTable.deletedAt} IS NULL
      JOIN ${productProductOptionValueTable} ON ${productProductOptionValueTable.id} = ${productVariantOptionTable.productProductOptionValueId}
        AND ${productProductOptionValueTable.deletedAt} IS NULL
      JOIN ${productProductOptionTable} ON ${productProductOptionTable.id} = ${productProductOptionValueTable.productProductOptionId}
        AND ${productProductOptionTable.deletedAt} IS NULL
      JOIN ${productOptionTable} ON ${productOptionTable.id} = ${productProductOptionTable.optionId}
        AND ${productOptionTable.deletedAt} IS NULL
      JOIN ${productOptionValueTable} ON ${productOptionValueTable.id} = ${productProductOptionValueTable.optionValueId}
        AND ${productOptionValueTable.deletedAt} IS NULL
      LEFT JOIN ${productOptionValueBucketTable} ON ${optionValueInBucket}
      LEFT JOIN ${productOptionBucketTable} ON ${optionValueBucket}
      LEFT JOIN (${this.stockedVariants()}) stocked_variant ON stocked_variant.variant_id = priced_variant.variant_id
      WHERE ${scope} AND ${this.purchasable(sql`priced_variant`, sql`stocked_variant.stocked`)}`)

    const [bounds, inStock] = await Promise.all([boundsQuery, inStockQuery])

    const [range] = bounds
    return {
      priceBounds: range?.min && range.max ? { min: new BigNumber(range.min), max: new BigNumber(range.max) } : null,
      inStockOptionValues: inStock.map((row) => ({ optionTitle: row.optionTitle, value: row.value })),
    }
  }

  /**
   * The products on sale in the market, as a subquery: published, with a variant a shopper can buy now
   * whose compare-at price in `currencyCode` is above its price. Read live from the prices, so a
   * markdown starts and ends with the price itself, with no sale grouping to keep in step.
   */
  saleProductIds({ currencyCode }: Pick<StoreCatalogFilters, 'currencyCode'>): SQL {
    return sql`SELECT priced_variant.product_id FROM (${this.pricedVariants(currencyCode)}) priced_variant
      JOIN ${productTable} ON ${productTable.id} = priced_variant.product_id
        AND ${productTable.deletedAt} IS NULL AND ${productTable.status} = 'published'
      LEFT JOIN (${this.stockedVariants()}) stocked_variant ON stocked_variant.variant_id = priced_variant.variant_id
      WHERE ${this.discounted(sql`priced_variant`)}
        AND ${this.purchasable(sql`priced_variant`, sql`stocked_variant.stocked`)}`
  }

  /**
   * The products the store filters' price selections keep, as one subquery for `selectedProductIds`:
   * a variant inside `priceRange`, and on sale when `onSale`. `undefined` when neither is asked.
   */
  selectedProductIds({
    currencyCode,
    priceRange,
    onSale,
  }: Omit<StoreCatalogFilters, 'products' | 'search'>): SQL | undefined {
    const { minPrice, maxPrice } = priceRange ?? {}
    const selections = [
      ...(minPrice === undefined && maxPrice === undefined
        ? []
        : [this.sellableProductIds({ currencyCode, priceRange })]),
      ...(onSale ? [this.saleProductIds({ currencyCode })] : []),
    ]
    if (selections.length === 0) return undefined
    return sql.join(selections, sql` INTERSECT `)
  }

  private async countListed(options: ListStoreProductsOptions, context?: Context): Promise<number> {
    const [row] = await this.getClient(context).execute<{ total: string }>(sql`
      SELECT COUNT(*) AS total FROM (
        SELECT ${productTable.id}
        FROM ${productTable}
        JOIN (${this.pricedVariants(options.currencyCode)}) priced_variant ON priced_variant.product_id = ${productTable.id}
        WHERE ${this.listWhere(options)}
        GROUP BY ${productTable.id}
        ${this.inPriceRange(options.priceRange)}
      ) listed`)
    return Number(row?.total ?? 0)
  }

  /** Every live variant with its price in `currencyCode`: the rows a product is listed, priced and stocked by. */
  private pricedVariants(currencyCode: string): SQL {
    return sql`
      SELECT ${productVariantTable.id} AS variant_id, ${productVariantTable.productId} AS product_id,
        ${productVariantTable.manageInventory} AS manage_inventory, ${productVariantTable.allowBackorder} AS allow_backorder,
        ${priceTable.amount} AS amount, ${priceTable.compareAtAmount} AS compare_at_amount,
        ${priceTable.priceSetId} AS price_set_id
      FROM ${productVariantTable}
      JOIN ${productVariantPriceSetTable} ON ${productVariantPriceSetTable.variantId} = ${productVariantTable.id}
        AND ${productVariantPriceSetTable.deletedAt} IS NULL
      JOIN ${priceTable} ON ${priceTable.priceSetId} = ${productVariantPriceSetTable.priceSetId}
        AND ${priceTable.currencyCode} = ${currencyCode}
        AND ${priceTable.deletedAt} IS NULL
      WHERE ${productVariantTable.deletedAt} IS NULL`
  }

  /** Any one priced variant inside the range keeps the product, as a `HAVING` over its priced variants. */
  private inPriceRange(priceRange: PriceRange): SQL {
    const { minPrice, maxPrice } = priceRange ?? {}
    if (minPrice === undefined && maxPrice === undefined) return sql``
    const above = minPrice === undefined ? sql`TRUE` : sql`priced_variant.amount >= ${minPrice}`
    const below = maxPrice === undefined ? sql`TRUE` : sql`priced_variant.amount <= ${maxPrice}`
    return sql`HAVING bool_or(${above} AND ${below})`
  }

  /**
   * The list's scope, narrowed by what only the list asks: a product like `similarTo` (sharing at least
   * one match, and not the product itself), and one a shopper can buy now.
   */
  private listWhere(options: ListStoreProductsOptions): SQL {
    const parts = [this.scopeWhere(options.products, options.search)]
    if (options.similarTo) {
      const sourceId = productIdByHandle(options.similarTo.handle)
      parts.push(sql`${productTable.id} IS DISTINCT FROM ${sourceId}`)
      parts.push(sql`${productSimilarity(sourceId, options.similarTo.match)} > 0`)
    }
    if (options.purchasableOnly) parts.push(this.hasPurchasableVariant(options.currencyCode, sql`${productTable.id}`))
    if (options.onSale) parts.push(sql`${productTable.id} IN (${this.saleProductIds(options)})`)
    return sql.join(parts, sql` AND `)
  }

  /** Some variant of `productId` priced in `currencyCode` can be bought now. */
  private hasPurchasableVariant(currencyCode: string, productId: SQL): SQL {
    return sql`EXISTS (
      SELECT 1 FROM (${this.pricedVariants(currencyCode)}) priced_variant
      LEFT JOIN LATERAL (${this.stockedVariants(sql`priced_variant.variant_id`)}) stocked_variant ON TRUE
      WHERE priced_variant.product_id = ${productId}
        AND ${this.purchasable(sql`priced_variant`, sql`stocked_variant.stocked`)}
    )`
  }

  /** `productId`'s cheapest variant a shopper can buy now that is marked down, else null. */
  private saleVariantId(currencyCode: string, productId: SQL): SQL {
    return sql`(
      SELECT priced_variant.variant_id FROM (${this.pricedVariants(currencyCode)}) priced_variant
      LEFT JOIN LATERAL (${this.stockedVariants(sql`priced_variant.variant_id`)}) stocked_variant ON TRUE
      WHERE priced_variant.product_id = ${productId}
        AND ${this.discounted(sql`priced_variant`)}
        AND ${this.purchasable(sql`priced_variant`, sql`stocked_variant.stocked`)}
      ORDER BY priced_variant.amount, priced_variant.variant_id
      LIMIT 1
    )`
  }

  /** The `variant` row's compare-at price is above its price: the markdown rule `calculatePrices` applies. */
  private discounted(variant: SQL): SQL {
    return sql`${variant}.compare_at_amount > ${variant}.amount`
  }

  /** The list's order, after the likeness to `similarTo` when there is one. */
  private rankedOrder({ sort, search, similarTo }: ListStoreProductsOptions): SQL {
    const order = this.listOrder(sort, search)
    if (!similarTo) return order
    return sql`${productSimilarity(productIdByHandle(similarTo.handle), similarTo.match)} DESC, ${order}`
  }

  /** The product list's scope: published, the product filters and the search. */
  private scopeWhere(products: FilterableProductProps, search?: string): SQL {
    return productWhere({
      ...products,
      ...(search ? buildSearchFilter(search, PRODUCT_SEARCH_COLUMNS) : {}),
      status: 'published',
    })
  }

  /**
   * Whether a shopper can put the `variant` row in a cart, as `variantStockProjection` answers it:
   * untracked or sold past zero always; otherwise only when `stocked` (from {@link stockedVariants})
   * says it has an inventory item behind it and enough of every one it takes.
   */
  private purchasable(variant: SQL, stocked: SQL): SQL {
    return sql`(NOT ${variant}.manage_inventory OR ${variant}.allow_backorder OR COALESCE(${stocked}, FALSE))`
  }

  /**
   * Per variant with an inventory item, `stocked`: every item it takes has at least the quantity it
   * takes on the shelf — stocked minus reserved, summed across locations. A variant with no item has
   * no row, which {@link purchasable} reads as not stocked.
   *
   * Given `variantId`, that one variant's row, its levels summed per item by index — for a `LATERAL`
   * join over a page. Without it, every variant at once, the levels summed in one pass, for a join
   * the planner hashes over the whole scope. Either shape is ~2× slower used for the other.
   */
  private stockedVariants(variantId?: SQL): SQL {
    const links = productVariantInventoryItemTable
    const levels = inventoryLevelTable
    return sql`SELECT ${links.variantId} AS variant_id,
        bool_and(COALESCE(available.quantity, 0) >= ${links.requiredQuantity}) AS stocked
      FROM ${links}
      ${
        variantId
          ? sql`LEFT JOIN LATERAL (
              SELECT SUM(${levels.stockedQuantity} - ${levels.reservedQuantity}) AS quantity
              FROM ${levels}
              WHERE ${levels.inventoryItemId} = ${links.inventoryItemId} AND ${levels.deletedAt} IS NULL
            ) available ON TRUE`
          : sql`LEFT JOIN (
              SELECT ${levels.inventoryItemId} AS inventory_item_id,
                SUM(${levels.stockedQuantity} - ${levels.reservedQuantity}) AS quantity
              FROM ${levels}
              WHERE ${levels.deletedAt} IS NULL
              GROUP BY ${levels.inventoryItemId}
            ) available ON available.inventory_item_id = ${links.inventoryItemId}`
      }
      WHERE ${links.deletedAt} IS NULL ${variantId ? sql`AND ${links.variantId} = ${variantId}` : sql``}
      GROUP BY ${links.variantId}`
  }

  /**
   * The `ORDER BY` for a sort, over the grouped `product` row.
   *
   * `relevance` ranks by how well the title answers the search, word by word: a whole title word, or a
   * word the brand holds, scores 3; the start of a title word 2; anywhere else 1. Every listed product
   * already holds every word somewhere, so the score only orders them — "samba" ranks the Samba above
   * the Sambarose, above a title holding it mid-word. Without a search it is `newest`.
   */
  private listOrder(sort: StoreProductSort, search?: string): SQL {
    const newest = sql`${productTable.createdAt} DESC, ${productTable.id} ASC`
    if (sort === 'priceAsc') return sql`MIN(priced_variant.amount) ASC, ${newest}`
    if (sort === 'priceDesc') return sql`MIN(priced_variant.amount) DESC, ${newest}`

    const words = sort === 'relevance' ? searchWords(search ?? '') : []
    if (words.length === 0) return newest

    const titleWords = sql`regexp_split_to_array(lower(${productTable.title}), ${WORD_SEPARATOR})`
    const scores = words.map(
      (word) => sql`CASE
        WHEN ${word} = ANY(${titleWords}) OR strpos(lower(COALESCE(${productTable.brand}, '')), ${word}) > 0 THEN 3
        WHEN EXISTS (SELECT 1 FROM unnest(${titleWords}) AS title_word WHERE starts_with(title_word, ${word})) THEN 2
        ELSE 1
      END`,
    )
    return sql`(${sql.join(scores, sql` + `)}) DESC, ${newest}`
  }
}

/** The search's words, lower-cased and split at spaces and punctuation, as the titles are. */
function searchWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter(Boolean)
}
