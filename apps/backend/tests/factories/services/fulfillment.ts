import type { AwilixContainer } from 'awilix'
import type { UpdateFulfillmentDTO } from '../../../src/core/types/fulfillment/mutations.js'
import type { IFulfillmentModuleService } from '../../../src/core/types/fulfillment/service.js'
import { Modules } from '../../../src/core/utils/index.js'
import { generateUpdateFulfillmentDTO } from '../fulfillment-dto.js'

// ---- Update ----

/** Direct write, for arranging a fulfillment state no workflow produces — a canceled one. */
export async function updateFulfillment(
  container: AwilixContainer,
  fulfillmentId: string,
  overrides?: Partial<UpdateFulfillmentDTO>,
) {
  const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  return fulfillmentService.updateFulfillment(fulfillmentId, generateUpdateFulfillmentDTO(overrides))
}

// ---- Reads ----

export async function retrieveFulfillment(container: AwilixContainer, fulfillmentId: string) {
  const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  return fulfillmentService.retrieveFulfillment(fulfillmentId)
}
