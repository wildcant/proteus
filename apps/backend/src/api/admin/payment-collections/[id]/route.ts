import type { IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminPaymentCollectionResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminPaymentCollectionResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const collection = await paymentService.retrievePaymentCollection(req.params.id)

  return { status: 200, json: { paymentCollection: collection } }
}
