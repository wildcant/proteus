import { SessionIdParams, StoreUpdatePaymentSessionResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { repricePaymentSessionWorkflow } from '@workflows/payment/reprice-payment-session.js'

export const PatchInput = { params: SessionIdParams }
export const PatchOutput = StoreUpdatePaymentSessionResponse

/**
 * Re-prices an open session from the cart's server-side total. There is no request body: the
 * amount is never taken from the browser, and anything one sends anyway is ignored.
 */
export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const paymentSession = await repricePaymentSessionWorkflow.run({
    paymentCollectionId: req.params.id,
    sessionId: req.params.sessionId,
  })

  return { status: 200, json: { paymentSession } }
}
