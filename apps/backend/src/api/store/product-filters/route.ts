import type { FilterableProductProps } from '@core/types/product/common.js'
import { buildSearchFilter, PRODUCT_SEARCH_COLUMNS } from '@core/utils/build-search-filter.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductFilterListParams,
  StoreProductFilterListResponse,
} from '@proteus/http-schemas/store'
import { COLOR_FILTER_KEY } from '@proteus/store-config'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { buildStoreProductFilters } from '@workflows/product/utils/build-store-product-filters.js'
import { setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductFilterListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductFilterListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const listing = linkService.repo('storeCatalogListing')

  const { filters: query, q } = req.validatedQuery
  const { category, collection, tag, filter, minPrice, maxPrice, exact, ...columnFilters } = query
  const { currencyCode } = req.pricingContext
  const priceRange = { minPrice, maxPrice }
  // The price range is a selection like the others: it moves the counts, so a range that keeps
  // nothing leaves every filter in place at 0 rather than taking them away.
  const hasPriceRange = minPrice !== undefined || maxPrice !== undefined

  // The list's scope before any selection: which values are offered, and what the price slider spans.
  const unsearched: FilterableProductProps = {
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection }),
    status: 'published' as const,
    sellableProductIds: listing.sellableProductIds({ currencyCode }),
  }
  const groupingSelections = buildStoreGroupingFilters({ tag, filter })
  // The same filters `GET /store/products` builds, so a count is the size of the list the value leads to.
  const selections: FilterableProductProps = {
    ...groupingSelections,
    ...(hasPriceRange ? { selectedProductIds: listing.sellableProductIds({ currencyCode, priceRange }) } : {}),
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

  // Price, stock and colour are read by the listing in SQL, over the scope; the metafield and option
  // counts stay with the product module, which takes the market's catalogue as a subquery.
  const [filters, facets, definitions, categories] = await Promise.all([
    productService.listProductFilters({ ...scope, ...selections }),
    listing.listStoreFacets({
      currencyCode,
      products: { ...columnFilters, ...buildStoreGroupingFilters({ category, collection }) },
      search,
      selections: groupingSelections,
      priceRange,
    }),
    productService.listMetafieldDefinitions(),
    productService.listCategories(),
  ])

  return {
    status: 200,
    json: {
      filters: buildStoreProductFilters(filters, facets.inStockOptionValues, {
        namedFieldKeys: new Set(
          definitions.filter((definition) => definition.source !== 'vendor').map((definition) => definition.key),
        ),
        categories,
        colorFilterKey: COLOR_FILTER_KEY,
      }),
      priceBounds: facets.priceBounds,
      correctedQuery,
    },
  }
}
