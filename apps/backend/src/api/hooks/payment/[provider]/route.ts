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
 * `process-payment-captured` subscriber. Once the event is *accepted* by the transport that work is
 * durable and has a bounded retry of its own, so a process that dies mid-way resumes rather than
 * losing the capture and a failure retries without waiting on the gateway to redeliver — which used
 * to be the only retry there was.
 *
 * That is also why the failures below are the only ones a caller sees. A subscriber's failure is
 * the transport's business and never becomes this response's: answering non-2xx for one would ask
 * Stripe to redeliver work that is already queued, which is a second delivery rather than a retry.
 *
 * ## What the acknowledgement does not cover, and it is not a small thing
 *
 * `emit` never rejects — the port's contract on every adapter, and every adapter honours it by
 * catching and logging (`inline-adapter.ts`, `cloudflare-queues-adapter.ts`, `temporal-adapter.ts`).
 * So a transport that is refusing writes — a Queues outage, a Temporal frontend that is down, a
 * dispatch identity the server rejects — is **not** a crash window and not a rare interleaving: it
 * logs one line, this route answers 200 anyway, Stripe records the event as delivered and stops
 * sending it, and that capture is gone. This route has no database write to be in a window after;
 * losing the publish loses the whole thing.
 *
 * Before the bus, the same outage would have been a non-2xx and Stripe would have redelivered. That
 * retry is the one thing this change removed, and nothing replaces it. The only trace is
 * `[event-bus] Could not dispatch "payment.captured" to "process-payment-captured"` at error level,
 * so **that line has to be something an operator alerts on** — it is the difference between a
 * shopper's charge being reconciled and being lost. ADR-0023 records it; closing it means an outbox,
 * which is adapter internals rather than a change here.
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
