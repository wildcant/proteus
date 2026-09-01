import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IPaymentModuleService } from '@core/types/index.js'
import type { Logger } from '@core/types/logger.js'
import type { PaymentActions } from '@core/types/payment/common.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { ProviderParams, WebhookReceivedResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

/**
 * What this route does with each action a provider can report. Total over `PaymentActions`, so
 * an action added to the union has to be given an answer here rather than falling through a
 * skip set that never heard of it — which is how `pending` used to reach the processing path
 * while `pending_authorization` was skipped.
 */
const ACTION_HANDLING: Record<PaymentActions, 'process' | 'skip'> = {
  authorized: 'process',
  captured: 'process',
  canceled: 'skip',
  failed: 'skip',
  // biome-ignore lint/style/useNamingConvention: mirrors the PaymentActions union member
  not_supported: 'skip',
  pending: 'skip',
  // biome-ignore lint/style/useNamingConvention: mirrors the PaymentActions union member
  pending_authorization: 'skip',
  // biome-ignore lint/style/useNamingConvention: mirrors the PaymentActions union member
  requires_more: 'skip',
}

export const PostInput = { params: ProviderParams }
export const PostOutput = WebhookReceivedResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)

  // The provider verifies a signature over these bytes. Without them there is nothing to verify
  // against, and passing a re-serialisation of the parsed body would only fake having them.
  if (!req.rawBody) {
    throw new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Webhook request carried no body' })
  }

  const { action, data } = await paymentService.getWebhookActionAndData({
    provider: req.params.provider,
    payload: {
      data: (req.body ?? {}) as Record<string, unknown>,
      rawData: req.rawBody,
      headers: req.headers,
    },
  })

  logger.info(`Webhook from "${req.params.provider}": action="${action}", sessionId="${data?.sessionId}"`)

  if (ACTION_HANDLING[action] === 'skip' || !data?.sessionId) {
    return { status: 200, json: { received: true } }
  }

  // TODO: Move to event/subscriber pattern with configurable delay for race condition handling
  if (action === 'authorized' || action === 'captured') {
    const payment = await paymentService.authorizePaymentSession(data.sessionId)

    if (action === 'captured' && payment) {
      await paymentService.capturePayment({ paymentId: payment.id, amount: data.amount })
    }
  }

  return { status: 200, json: { received: true } }
}
