import type { AppContainer } from '../../../src/core/types/container.js'
import type { UpdateFulfillmentDTO } from '../../../src/core/types/fulfillment/mutations.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import { generateUpdateFulfillmentDTO } from '../fulfillment-dto.js'

// ---- Update ----

/** Direct write, for arranging a fulfillment state no workflow produces — a canceled one. */
export async function updateFulfillment(
  container: AppContainer,
  fulfillmentId: string,
  overrides?: Partial<UpdateFulfillmentDTO>,
) {
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  return fulfillmentService.updateFulfillment(fulfillmentId, generateUpdateFulfillmentDTO(overrides))
}

// ---- Reads ----

export async function retrieveFulfillment(container: AppContainer, fulfillmentId: string) {
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  return fulfillmentService.retrieveFulfillment(fulfillmentId)
}
