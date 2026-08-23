import type { AwilixContainer } from 'awilix'
import type { FilterableOrderProps } from '../../../src/core/types/order/common.js'
import type { IOrderModuleService } from '../../../src/core/types/order/service.js'
import { Modules } from '../../../src/core/utils/index.js'

// ---- Reads ----

export async function listOrders(container: AwilixContainer, filters?: FilterableOrderProps) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  return orderService.listOrders(filters)
}
