import type { AwilixContainer } from 'awilix'
import type { Event, EventName, EventPayloads } from './events.js'

/**
 * The publish surface — the whole of what a caller sees.
 *
 * Nothing about the transport underneath reaches this signature: no queue, no key, no delay, no
 * options bag. A workflow's final step, a route handler and a job all call the same two-argument
 * function, and the adapter behind it is chosen at a composition root.
 *
 * **It resolves on acceptance, not on completion.** `await bus.emit(…)` means the event has been
 * handed to the transport, never that a subscriber finished. That is the contract the checkout path
 * depends on: the payment is already authorized by the time the confirmation is published, so a
 * failing mail provider must not be able to throw back into the workflow and refund a valid order.
 * Subscriber failure is the transport's business, and every adapter has to keep it that way.
 *
 * **It does not reject for transport failures either.** An adapter that could not reach its
 * transport, or could not derive a sendable identity for the delivery, logs it and resolves. The
 * argument is the same one and it does not weaken when the failure moves from the subscriber to the
 * wire: a checkout workflow's final step must not compensate an authorized payment because a queue
 * was briefly unreachable. The honest cost is that such an event is **lost**, with a log line as its
 * only trace — small, deliberate, and closed later by an outbox table, which changes adapter
 * internals rather than this signature.
 *
 * A `Promise<void>` with no failure channel is therefore the whole return type on purpose: there is
 * no outcome for a caller to branch on, so there is none to hand back.
 */
export type EventBus = {
  emit<N extends EventName>(name: N, data: EventPayloads[N]): Promise<void>
}

/** What a subscriber handler is handed — the event, and the same container a route handler uses. */
export type SubscriberArgs<TEvent extends EventName> = {
  event: Event<TEvent>
  container: AwilixContainer
}

/**
 * A subscriber's declaration, exported as `config` from a file in `src/subscribers/`. The same shape
 * as `JobDefinition`, so there is one file convention in this codebase for "code that runs on a
 * trigger".
 *
 * `TEvent` has **no default**, deliberately. A `SubscriberConfig` written without it would otherwise
 * widen to every event in the map, and the handler would stop type-checking against the payloads it
 * actually receives instead of failing to compile. Omitting it is an error you get told about.
 */
export type SubscriberConfig<TEvent extends EventName> = {
  /**
   * The subscriber's identity, and the subscriber half of the dispatch key.
   *
   * Required, and **not inferred from the filename**: a filename-derived identity means renaming a
   * file silently changes the dedup key, so events in flight are re-dispatched to what the transport
   * reads as a brand new subscriber.
   */
  name: string
  event: TEvent | readonly TEvent[]
  handler: (args: SubscriberArgs<TEvent>) => Promise<void>
}

/** One subscriber, with its type argument erased — what a registry can hold and an adapter can call. */
export type SubscriberDefinition = {
  name: string
  events: readonly EventName[]
  handler: (args: SubscriberArgs<EventName>) => Promise<void>
}

/**
 * Erases `TEvent` so subscribers of different event unions can sit in one list.
 *
 * Called by the generated registry rather than by the subscriber file, which is why a subscriber
 * file has no wrapper call in it at all — the same reason `src/jobs/` has none. The cast is safe by
 * construction and unprovable to the compiler: `config.handler` accepts exactly the events
 * `config.event` names, and the adapter only ever calls it with one of those.
 */
export function defineSubscriber<TEvent extends EventName>(config: SubscriberConfig<TEvent>): SubscriberDefinition {
  return {
    name: config.name,
    events: typeof config.event === 'string' ? [config.event] : [...config.event],
    handler: config.handler as SubscriberDefinition['handler'],
  }
}
