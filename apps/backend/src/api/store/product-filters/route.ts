import type { FilterableProductProps } from '@core/types/product/common.js'
import { buildSearchFilter, PRODUCT_SEARCH_COLUMNS } from '@core/utils/build-search-filter.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { SALE_FILTER_KEY } from '@core/utils/product-filter-key.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductFilterListParams,
  StoreProductFilterListResponse,
} from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters, selectsSale } from '@workflows/product/utils/build-store-grouping-filters.js'
import {
  buildSaleFilter,
  buildStoreProductFilters,
  orderStoreFilters,
} from '@workflows/product/utils/build-store-product-filters.js'
import { setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductFilterListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductFilterListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const storeService = req.scope.resolve(Modules.STORE)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const listing = linkService.repo('storeCatalogListing')

  const { filters: query, q } = req.validatedQuery
  const { category, collection, tag, filter, minPrice, maxPrice, exact, ...columnFilters } = query
  const { currencyCode } = req.pricingContext
  const priceRange = { minPrice, maxPrice }
  const onSale = selectsSale(filter)

  // The list's scope before any selection: which values are offered, and what the price slider spans.
  const unsearched: FilterableProductProps = {
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection }),
    status: 'published' as const,
    sellableProductIds: listing.sellableProductIds({ currencyCode }),
  }
  const groupingSelections = buildStoreGroupingFilters({ tag, filter })
  // The same filters `GET /store/products` builds, so a count is the size of the list the value leads to.
  // The price range and the sale filter are selections like the others: they move the counts, so a
  // range that keeps nothing leaves every filter in place at 0 rather than taking them away.
  const selections: FilterableProductProps = {
    ...groupingSelections,
    selectedProductIds: listing.selectedProductIds({ currencyCode, priceRange, onSale }),
  }

  // Corrected exactly when the list corrects — `q`, not asked for as written, matching nothing under
  // the same selections — so the counts describe the products the list then shows.
  const [asked] =
    q && !exact
      ? await productService.listProducts(
          { ...unsearched, ...selections, ...buildSearchFilter(q, PRODUCT_SEARCH_COLUMNS) },
          { select: ['id'], limit: 1 },
        )
      : []
  const correctedQuery =
    q && !exact && !asked ? await productService.correctProductSearch(q, { ...unsearched, ...selections }) : null
  const search = correctedQuery ?? q
  const scope = { ...unsearched, ...(search ? buildSearchFilter(search, PRODUCT_SEARCH_COLUMNS) : {}) }

  const store = await storeService.resolveStore()
  // The structure file offers the sale filter by listing its key, as it does any other.
  const offersSale = store?.filters?.includes(SALE_FILTER_KEY) ?? false
  // Price and stock are read by the listing in SQL, over the scope; the metafield and option
  // counts stay with the product module, which takes the market's catalogue as a subquery.
  const [filters, facets, definitions, categories, saleCount] = await Promise.all([
    productService.listProductFilters({ ...scope, ...selections }),
    listing.listStoreFacets({
      currencyCode,
      products: { ...columnFilters, ...buildStoreGroupingFilters({ category, collection }) },
      search,
    }),
    productService.listMetafieldDefinitions(),
    productService.listCategories(),
    // Counted as though it were chosen, whether or not it is, like every other value: what the list
    // would hold with it, under the other selections.
    offersSale
      ? productService
          .listAndCountProducts(
            {
              ...scope,
              ...selections,
              selectedProductIds: listing.selectedProductIds({ currencyCode, priceRange, onSale: true }),
            },
            { select: ['id'], limit: 1 },
          )
          .then(([, count]) => count)
      : 0,
  ])
  // Offered only while something is on sale, so the filter never leads to an empty list.
  const offered = saleCount > 0 ? [...filters, buildSaleFilter(saleCount)] : filters

  return {
    status: 200,
    json: {
      // The structure file's `filters` decides which facets show, and in what order.
      filters: buildStoreProductFilters(
        orderStoreFilters(offered, store?.filters ?? null),
        facets.inStockOptionValues,
        {
          namedFieldKeys: new Set(
            definitions.filter((definition) => definition.source !== 'vendor').map((definition) => definition.key),
          ),
          categories,
        },
      ),
      priceBounds: facets.priceBounds,
      correctedQuery,
    },
  }
}
