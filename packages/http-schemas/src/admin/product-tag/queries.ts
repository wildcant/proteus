import { createFindParams, type FindParams, searchTerm } from '../../common.js'

export const AdminProductTagListParams = createFindParams().extend({
  q: searchTerm,
})
export type AdminProductTagListQuery = FindParams<typeof AdminProductTagListParams>
