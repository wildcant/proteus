import { createFindParams, type FindParams } from '../../common.js'

export const StoreOrderListParams = createFindParams()

export type StoreOrderListQuery = FindParams<typeof StoreOrderListParams>
