import type { EventName, EventPayloads } from './events.js'

/**
 * The publish surface — the whole of what a caller sees.
 *
 * Nothing about the transport underneath reaches this signature: no queue, no key, no delay, no
 * options bag. A workflow's final step, a route handler and a job all call the same two-argument
 * function, and the adapter behind it is chosen at a composition root.
 *
 * **It resolves on acceptance, not on completion.** `await bus.emit(…)` means the event has been
 * handed to the transport, never that a subscriber finished. Subscriber failure is the transport's
 * business, and every adapter has to keep it that way.
 *
 * **`emit` resolves on acceptance and never rejects** — not for a subscriber failure, not for a
 * transport failure, and not for a delivery the adapter itself refuses to send. Every such case is
 * logged at error level naming the event and the subscriber, and that event is lost; the log line is
 * its only trace. That is the residual D8 accepts, and the fix is an outbox, which changes adapter
 * internals rather than this signature.
 *
 * One rule for every adapter, not a property of whichever one a runtime resolves. A caller cannot
 * know which runtime it is on, so a guarantee that held on node and not on workerd would not be a
 * contract at all — and ILLO-89 writes a bare `await bus.emit(...)` into checkout's final step,
 * after the payment is authorized, where a rejection compensates the workflow and refunds a valid
 * order. Losing an event is recoverable by replay; refunding a paid order in front of a shopper is
 * not.
 *
 * A `Promise<void>` with no failure channel is therefore the whole return type on purpose: there is
 * no outcome for a caller to branch on, so there is none to hand back.
 */
export type EventBus = {
  emit<N extends EventName>(name: N, data: EventPayloads[N]): Promise<void>
}
