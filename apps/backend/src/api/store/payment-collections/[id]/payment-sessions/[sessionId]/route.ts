import { SessionIdParams, StoreUpdatePaymentSessionResponse, UpdatePaymentSession } from '@proteus/http-schemas/store'
import { repricePaymentSessionWorkflow } from '@workflows/payment/reprice-payment-session.js'
import type { HttpRequest, HttpResult } from '../../../../../../server/ports.js'

export const PatchInput = { params: SessionIdParams, body: UpdatePaymentSession }
export const PatchOutput = StoreUpdatePaymentSessionResponse

/**
 * Re-prices an open session from the cart's server-side total. The body is empty by design — see
 * `UpdatePaymentSession`; an amount is never taken from the browser.
 */
export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const paymentSession = await repricePaymentSessionWorkflow.run({
    paymentCollectionId: req.params.id,
    sessionId: req.params.sessionId,
  })

  return { status: 200, json: { paymentSession } }
}
