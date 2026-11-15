import { type ExtensionEvent, keyById } from '../extensions/define-event.js'
import type { PaymentActions } from '../types/payment/common.js'

/**
 * The two provider actions a `payment.captured` delivery can be about.
 *
 * Narrowed from [PaymentActions] rather than written out, so the union cannot drift from the one
 * the provider adapters produce. The webhook route's handling map is what decides which actions
 * reach here at all, and it is total over the wider union — an action added later has to be given
 * an answer there rather than falling into this one by accident.
 */
export type PaymentCapturedAction = Extract<PaymentActions, 'authorized' | 'captured'>

/**
 * Every event this backend can publish, and the payload each one carries.
 *
 * This map is the whole type story of the bus. `emit` takes `keyof` it as the name and the matching
 * value as the data, so an event name that is not here — or a payload that does not match the one
 * that is — is a `tsc` failure rather than a message nobody receives. That is the point of a central
 * map over a string argument: a typo in `'order.plcaed'` costs a build, not a silent no-op.
 *
 * An event is added here **because a subscriber wants it**, never in advance. A catalogue of names
 * nothing consumes is a catalogue nobody can delete from, because no one can tell which entries are
 * live. `order.placed` and `payment.captured` arrive with the subscribers that read them.
 */
type EventPayloads = {
  /** The bus's own round trip, the way `pingWorkflow` is the workflow engine's. Nothing else emits it. */
  'bus.probe': { id: string }
  /** The same probe, for the event shape that legitimately fires more than once per resource. */
  'bus.probe.repeatable': { id: string; attempt: number }
  /**
   * An order exists and its payment is authorized — published by checkout's final step, and by
   * nothing else.
   *
   * The id is the order's, which is what makes it *once per resource*: an order is placed once, so
   * the derived dispatch identity is the same on every republish and the transport dedups a repeat.
   * That is load-bearing rather than incidental — the publisher is a workflow step, and a step that
   * retries runs its action again. An id minted inside that action would be a new one per attempt,
   * a new dispatch identity, and a second confirmation email nobody asked for.
   *
   * Nothing else about the order travels. A subscriber reads what it needs through the id, so a
   * delivery that arrives late describes the order as it is now rather than as it was at checkout.
   */
  'order.placed': { id: string }
  /**
   * A payment provider reported that a session's money has moved — published by the payment webhook
   * route, and by nothing else.
   *
   * The id is the **payment session's**, because that is what the provider's event is about and what
   * every reader of this event starts from: the payment, the payment collection and the cart behind
   * it are all reachable through it, and a delivery that arrives late describes them as they are now.
   *
   * `action` is what the provider actually reported, and it is part of the dispatch key rather than
   * only of the payload (see [EVENT_KEYS]). A manual-capture session legitimately produces two
   * events — authorized when the shopper confirms, captured when the money is taken — and keying on
   * the session alone would dedup the second into the first and silently never deliver it.
   */
  'payment.captured': { id: string; action: PaymentCapturedAction }
  /**
   * An Inventory Level's Available Quantity moved **down** — published wherever it can: the
   * reservation checkout takes, the adjustment fulfillment makes, and the admin's stock write.
   *
   * Deliberately **not** Medusa's `inventory-level.updated`. That one fires on stocked changes only
   * and explicitly not on reservations; reusing the name for something with a wider trigger is the
   * one case where matching Medusa's names would make a schema-or-event comparison lie.
   *
   * The `id` is the level's and `version` is the row's write counter — together they are the
   * change's *identity* (see [EVENT_KEYS]). The two quantities travel for the reader's benefit
   * only; `alert-low-stock` re-reads the level, so a late delivery describes the shelf as it is
   * now rather than as the payload found it.
   */
  'inventory.available_decreased': { id: string; version: number; stockedQuantity: number; reservedQuantity: number }
  /**
   * A merchant confirmed a previewed product import — published by the confirm route once the job
   * is `importing`, and by nothing else.
   *
   * The id is the job's, and a job is confirmed once, so a repeat is a redelivery. The import itself
   * runs in `run-product-import`, off the request: a catalogue of thousands of products downloads
   * images and writes for longer than a request is allowed to take.
   */
  'product.import_confirmed': { id: string }
}

export type EventName = keyof EventPayloads

/**
 * What names an event at a call site: a core event's name, or an extension's event value. Extension
 * events sit beside the closed map rather than in it, so a fork adds them without editing this file.
 */
export type EventRef = EventName | ExtensionEvent

/** The payload an event carries, whichever of the two declared it. */
export type EventPayload<R extends EventRef> = R extends EventName
  ? EventPayloads[R]
  : R extends ExtensionEvent<infer P>
    ? P
    : never

/**
 * What a subscriber is handed. Distributive on purpose: `Event<'a' | 'b'>` is
 * `{name:'a', data:Pa} | {name:'b', data:Pb}`, not `{name:'a'|'b', data:Pa|Pb}`, so a handler that
 * switches on `event.name` narrows `event.data` with it. An extension event's name is a plain
 * string, so a handler on two of them narrows by comparing `event.name` to each event's `name`.
 */
export type Event<R extends EventRef = EventRef> = R extends EventRef
  ? {
      name: R extends EventName ? R : string
      data: EventPayload<R>
      /**
       * This delivery's identity — `${name}:${key}:${subscriber}`, derived by the bus. A subscriber
       * gets it because every subscriber has to be idempotent (the weaker of the two transport
       * contracts is at-least-once with no dedup), and this is the key to be idempotent *against*.
       */
      dispatchId: string
    }
  : never

/** The name an event travels under. */
export function eventNameOf(event: EventRef): string {
  return typeof event === 'string' ? event : event.name
}

/**
 * How the resource half of the dispatch identity is read out of a payload, for the events where
 * `data.id` is the wrong answer.
 *
 * The default — `data.id` — means *once per resource*, which is right for an event that can only
 * happen once to a thing: an order is placed once, a payment is captured once. It is wrong for
 * something like `order.updated`, where a second, genuinely different update to the same order
 * would be deduped into the first and silently never delivered. That failure has no error and no
 * log line, so the escape hatch exists from day one rather than being discovered by the event that
 * needs it.
 */
const EVENT_KEYS: { [N in EventName]?: (data: EventPayloads[N]) => string } = {
  'bus.probe.repeatable': (data) => `${data.id}:${data.attempt}`,
  /**
   * The first production event to need this. One session can be authorized and then captured, which
   * is two different things happening to the same resource — `data.id` alone would make the capture
   * a duplicate of the authorization and drop it. A *redelivery* of either still keys identically,
   * which is what makes a repeat of one webhook a duplicate rather than a second capture.
   */
  'payment.captured': (data) => `${data.id}:${data.action}`,
  /**
   * The level *and* the row's write counter, for the same reason `payment.captured` keys on its
   * action: one level legitimately goes low more than once. Keying on the level id alone would be
   * once-per-level-forever — a variant that dips low, is restocked and dips again would be deduped
   * into permanent silence, the failure with no error and no log line.
   *
   * The counter rather than the quantities, because the quantities do not identify the change: a
   * shelf that dips to 3, is restocked and dips to 3 again produces the same pair twice, and the
   * second crossing would be swallowed as a redelivery of the first. A wall-clock stamp has the
   * same hole at millisecond resolution; the counter is bumped by the write itself, so two writes
   * can never share one. A *redelivery* still keys identically, which is what keeps dedup working.
   */
  'inventory.available_decreased': (data) => `${data.id}:${data.version}`,
}

/**
 * The resource key for one event: `keyById` unless the map overrides it. Every payload in
 * `EventPayloads` carries an `id`, so the default always has one to read.
 *
 * An extension event brings its own key with it (`defineEvent`), passed in as `key`; core's map is
 * not consulted for a name it cannot hold.
 */
function eventKey(name: string, data: unknown, key: ((data: unknown) => string) | undefined): string {
  if (key) return key(data)
  const custom = (EVENT_KEYS as Partial<Record<string, (data: unknown) => string>>)[name]
  return custom ? custom(data) : keyById(data)
}

/**
 * The identity of one delivery, to one subscriber.
 *
 * Derived here and nowhere else. An earlier shape took the key as an argument to `emit`, and a
 * hand-written key that disagreed with the payload would have defeated dedup *silently* — the
 * publisher would look correct, the transport would see two distinct events, and the subscriber
 * would run twice. No call site supplies it, so no call site can get it wrong.
 *
 * The subscriber name is part of it because dedup is per subscriber: two subscribers on
 * `order.placed` are two deliveries, and collapsing them would drop one.
 */
function dispatchIdentity(
  name: string,
  data: unknown,
  subscriber: string,
  key: ((data: unknown) => string) | undefined,
): string {
  return `${name}:${eventKey(name, data, key)}:${subscriber}`
}

/**
 * The event object handed to one subscriber, for a core event or an extension one. Read back by
 * name — off a queue, or out of the registry — so an extension event's declaration arrives as the
 * subscriber's `keys` rather than as a value.
 *
 * The cast is the one place the payload is widened back to the `Event` union. TypeScript cannot
 * prove `{ name; data }` is a member of a union it distributed over every event, even though every
 * delivery is; keeping the widening here means no adapter and no call site has to repeat it.
 */
export function buildDelivery(
  name: string,
  data: unknown,
  subscriber: { name: string; keys?: Readonly<Record<string, (data: unknown) => string>> },
): Event {
  const key = subscriber.keys?.[name]
  return { name, data, dispatchId: dispatchIdentity(name, data, subscriber.name, key) } as Event
}
