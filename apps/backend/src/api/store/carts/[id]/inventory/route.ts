import { IdParams, StoreCartInventoryResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { confirmInventoryWorkflow } from '@workflows/cart/confirm-inventory-workflow.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreCartInventoryResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const result = await confirmInventoryWorkflow.run({ cartId: req.params.id })

  return { status: 200, json: result }
}
