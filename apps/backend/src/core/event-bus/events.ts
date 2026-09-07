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
export type EventPayloads = {
  /** The bus's own round trip, the way `pingWorkflow` is the workflow engine's. Nothing else emits it. */
  'bus.probe': { id: string }
  /** The same probe, for the event shape that legitimately fires more than once per resource. */
  'bus.probe.repeatable': { id: string; attempt: number }
}

export type EventName = keyof EventPayloads

/**
 * What a subscriber is handed. Distributive on purpose: `Event<'a' | 'b'>` is
 * `{name:'a', data:Pa} | {name:'b', data:Pb}`, not `{name:'a'|'b', data:Pa|Pb}`, so a handler that
 * switches on `event.name` narrows `event.data` with it.
 */
export type Event<N extends EventName = EventName> = N extends EventName
  ? {
      name: N
      data: EventPayloads[N]
      /**
       * This delivery's identity — `${name}:${key}:${subscriber}`, derived by the bus. A subscriber
       * gets it because every subscriber has to be idempotent (the weaker of the two transport
       * contracts is at-least-once with no dedup), and this is the key to be idempotent *against*.
       */
      dispatchId: string
    }
  : never

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
}

/**
 * The resource key for one event. `data.id` unless the map overrides it — and `data.id` only
 * compiles because every payload above carries one, which is how that requirement is enforced.
 */
function eventKey<N extends EventName>(name: N, data: EventPayloads[N]): string {
  const custom = EVENT_KEYS[name]
  return custom ? custom(data) : data.id
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
export function dispatchIdentity<N extends EventName>(name: N, data: EventPayloads[N], subscriber: string): string {
  return `${name}:${eventKey(name, data)}:${subscriber}`
}

/**
 * The event object handed to one subscriber.
 *
 * The cast is the one place the generic `N` is widened back to the `Event` union. TypeScript cannot
 * prove `{ name: N; data: EventPayloads[N] }` is a member of a union it distributed over `N`, even
 * though every instantiation is; keeping the widening here means no adapter and no call site has to
 * repeat it.
 */
export function buildEvent<N extends EventName>(name: N, data: EventPayloads[N], subscriber: string): Event {
  return { name, data, dispatchId: dispatchIdentity(name, data, subscriber) } as Event
}
