import { createFindParams, type FindParams, searchTerm } from '../../common.js'

export const AdminProductCollectionListParams = createFindParams().extend({
  q: searchTerm,
})
export type AdminProductCollectionListQuery = FindParams<typeof AdminProductCollectionListParams>
