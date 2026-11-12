import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { StoreNavigationResponse, StorePricingContextParams } from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { buildStoreNavigation } from '@workflows/store/utils/build-store-navigation.js'
import { listSellableProducts, setPricingContext } from '../middlewares.js'

export const GetInput = { contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreNavigationResponse

/**
 * The menu as the last applied structure file has it, its sections resolved into links. A
 * deployment with no store has an empty one.
 *
 * A `valores`, grouped `valores` or `opcion` section reads its values off the products the entry's
 * own list shows — sellable in this market, published, in the Category (with its Visible descendants)
 * or the Collection — so every link leads to a list with products in it.
 */
export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const storeService = req.scope.resolve(Modules.STORE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const store = await storeService.resolveStore()
  const navigation = store?.navigation ?? []
  if (navigation.length === 0) return { status: 200, json: { navigation: [] } }

  const readsProducts = navigation.some((entry) =>
    entry.sections.some(
      (section) => section.type === 'values' || section.type === 'groups' || section.type === 'option',
    ),
  )
  const [categoryTree, [collections], { productIds }] = await Promise.all([
    productService.listCategoryTree({ visibleOnly: true }),
    productService.listAndCountCollections(),
    // Only a section that reads products needs the market's catalogue, and it is the costly read.
    readsProducts ? listSellableProducts(req.scope, req.pricingContext) : { productIds: [] },
  ])

  const read = await Promise.all(
    navigation.map(async (entry) => ({
      ...entry,
      sections: await Promise.all(
        entry.sections.map(async (section) => {
          if (section.type === 'subcategories' || section.type === 'links') return section
          // An empty id list would reach the query builder as `inArray(column, [])`.
          if (productIds.length === 0) {
            return section.type === 'groups' ? { ...section, read: [] } : { ...section, values: [] }
          }
          const scope = {
            ...buildStoreGroupingFilters(
              entry.type === 'category' ? { category: entry.handle } : { collection: entry.handle },
            ),
            status: 'published' as const,
            id: productIds,
          }
          if (section.type === 'groups') {
            return {
              ...section,
              read: await productService.listProductFieldGroups(section.key, section.groupKey, scope),
            }
          }
          const values =
            section.type === 'option'
              ? await productService.listOfferedOptionValues(section.option, scope)
              : await productService.listProductFieldValues(section.key, scope)
          return { ...section, values }
        }),
      ),
    })),
  )

  return { status: 200, json: { navigation: buildStoreNavigation(read, { categoryTree, collections }) } }
}
