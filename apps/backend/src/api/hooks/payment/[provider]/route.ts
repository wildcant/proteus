import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { PaymentCapturedAction } from '@core/event-bus/events.js'
import type { EventBus } from '@core/event-bus/types.js'
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
 *
 * The two published actions map to themselves rather than to a `'publish'` marker, because the
 * value is what travels in the event's payload: reading it out of the table is what narrows
 * `PaymentActions` down to the pair a `payment.captured` delivery can carry, with no cast.
 */
const ACTION_HANDLING: Record<PaymentActions, PaymentCapturedAction | 'skip'> = {
  authorized: 'authorized',
  captured: 'captured',
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
export const PostThrows = [ErrorTypes.INVALID_DATA] as const

/**
 * The gateway's end of the payment webhook: verify the signature, decide whether the event says
 * anything, publish it, acknowledge.
 *
 * **It performs no state transition.** Everything the event means happens in the
 * `process-payment-captured` subscriber, which is a durable unit of work with a bounded retry of
 * its own — so a process that dies mid-way resumes rather than losing the capture, and a failure
 * retries without waiting on the gateway to redeliver, which used to be the only retry there was.
 *
 * That is also why the failures below are the only ones a caller sees. A subscriber's failure is
 * the transport's business and never becomes this response's: answering non-2xx for one would ask
 * Stripe to redeliver work that is already queued, which is a second delivery rather than a retry.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const bus = req.scope.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)

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
  const handling = ACTION_HANDLING[action]
  const sessionId = data?.sessionId
  if (handling === 'skip' || !sessionId) {
    return { status: 200, json: { received: true } }
  }

  await bus.emit('payment.captured', { id: sessionId, action: handling })

  return { status: 200, json: { received: true } }
}
