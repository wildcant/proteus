import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IPaymentModuleService } from '@core/types/index.js'
import type { Logger } from '@core/types/logger.js'
import type { PaymentActions } from '@core/types/payment/common.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { ProviderParams, WebhookReceivedResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'

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

  // An event this route does not act on — an event type the dashboard has enabled, another
  // integration sharing the Stripe account, an intent still settling — costs one acknowledgement
  // and nothing else. Not even a read.
  const sessionId = data?.sessionId
  if (ACTION_HANDLING[action] === 'skip' || !sessionId) {
    return { status: 200, json: { received: true } }
  }

  // TODO(events): processed inline, so a webhook that overtakes the shopper's own checkout —
  // Stripe sends `payment_intent.succeeded` the moment the browser confirms, while `completeCart`
  // is still creating the order — races it. Delaying and retrying belongs to the event bus, which
  // is why the interim runner that did it here was dropped rather than merged.
  await processAuthorizedSession(paymentService, action, sessionId)

  return { status: 200, json: { received: true } }
}

/**
 * Has to be safe to run twice: Stripe redelivers until it is acknowledged, and a redelivery lands
 * here as a second, independent run. Anything this throws reaches the gateway as a non-2xx, which
 * is what makes it redeliver — the only retry there is until the event bus brings its own.
 */
async function processAuthorizedSession(
  paymentService: IPaymentModuleService,
  action: PaymentActions,
  sessionId: string,
): Promise<void> {
  const authorization = await paymentService.authorizePaymentSession(sessionId)

  // Nothing to capture unless a payment came out of it. An event can reach here describing an
  // intent that has since moved on — a redelivery of one the shopper cancelled, or one still
  // settling — and neither outcome has a payment to take money against.
  if (authorization.outcome !== 'authorized') return

  // Only if the money is not already taken. Stripe redelivers an event until it is
  // acknowledged, and `authorizePaymentSession` captures the payment itself when the intent
  // already reports a completed charge — so by here the capture may well have happened.
  // Capturing again cannot take the money twice (`capturePayment` refuses), but it would raise,
  // and a raise here turns a delivery that already worked into a redelivery. A capture takes the
  // whole authorization, so `capturedAt` settles it: it is set by the only capture there can be.
  if (action === 'captured' && !authorization.payment.capturedAt) {
    await paymentService.capturePayment({ paymentId: authorization.payment.id })
  }
}
