import { createFindParams, type FindParams, searchTerm } from '../../common.js'

export const AdminProductTypeListParams = createFindParams().extend({
  q: searchTerm,
})
export type AdminProductTypeListQuery = FindParams<typeof AdminProductTypeListParams>
