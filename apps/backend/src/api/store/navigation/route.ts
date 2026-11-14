import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { StoreNavigationResponse, StorePricingContextParams } from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { buildStoreNavigation } from '@workflows/store/utils/build-store-navigation.js'
import { setPricingContext } from '../middlewares.js'

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

  // The market's catalogue as a subquery each section's read joins, rather than a list of ids.
  const sellableProductIds = req.scope
    .resolve(ContainerRegistrationKeys.LINK)
    .repo('storeCatalogListing')
    .sellableProductIds({ currencyCode: req.pricingContext.currencyCode })
  const [categoryTree, [collections]] = await Promise.all([
    productService.listCategoryTree({ visibleOnly: true }),
    productService.listAndCountCollections(),
  ])

  const read = await Promise.all(
    navigation.map(async (entry) => ({
      ...entry,
      sections: await Promise.all(
        entry.sections.map(async (section) => {
          if (section.type === 'subcategories' || section.type === 'links') return section
          const scope = {
            ...buildStoreGroupingFilters(
              entry.type === 'category' ? { category: entry.handle } : { collection: entry.handle },
            ),
            status: 'published' as const,
            sellableProductIds,
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
