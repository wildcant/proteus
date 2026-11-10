import type { QueryClient } from '@tanstack/react-query'
import { categoryTreeQueryOptions } from '#/features/categories/api/categories'
import { allCollectionsQueryOptions } from '#/features/collections/api/collections'
import { allProductTagsQueryOptions } from '#/features/product-tags/api/product-tags'
import { allProductTypesQueryOptions } from '#/features/product-types/api/product-types'

/**
 * Everything the product form's Organization fields offer, for a route loader: the category picker
 * browses the whole tree, and Type, Collections and Tags offer every row.
 */
export const ensureOrganizationOptions = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.ensureQueryData(categoryTreeQueryOptions()),
    queryClient.ensureQueryData(allCollectionsQueryOptions()),
    queryClient.ensureQueryData(allProductTypesQueryOptions()),
    queryClient.ensureQueryData(allProductTagsQueryOptions()),
  ])
