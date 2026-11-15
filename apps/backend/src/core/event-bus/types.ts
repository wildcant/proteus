import type { AppContainer } from '../types/container.js'
import { type Event, type EventRef, eventNameOf } from './events.js'

/** What a subscriber handler is handed — the event, and the same container a route handler uses. */
export type SubscriberArgs<TEvent extends EventRef> = {
  event: Event<TEvent>
  container: AppContainer
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
export type SubscriberConfig<TEvent extends EventRef> = {
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
  events: readonly string[]
  /**
   * The resource key of each extension event this subscriber names, by event name. A delivery read
   * back off a transport carries only the name, so this is how its identity is derived the way the
   * event declared it. Core events are keyed by `EVENT_KEYS` and have no entry.
   */
  keys?: Readonly<Record<string, (data: unknown) => string>>
  handler: (args: SubscriberArgs<EventRef>) => Promise<void>
}

/**
 * Erases `TEvent` so subscribers of different event unions can sit in one list.
 *
 * Called by the generated registry rather than by the subscriber file, which is why a subscriber
 * file has no wrapper call in it at all — the same reason `src/jobs/` has none. The cast is safe by
 * construction and unprovable to the compiler: `config.handler` accepts exactly the events
 * `config.event` names, and the adapter only ever calls it with one of those.
 */
export function defineSubscriber<TEvent extends EventRef>(config: SubscriberConfig<TEvent>): SubscriberDefinition {
  const events: readonly EventRef[] = isEventList(config.event) ? config.event : [config.event]
  const keys = Object.fromEntries(
    events.flatMap((event) =>
      typeof event === 'string' ? [] : [[event.name, (data: unknown) => event.key(data)] as const],
    ),
  )

  return {
    name: config.name,
    events: events.map(eventNameOf),
    ...(Object.keys(keys).length > 0 ? { keys } : {}),
    handler: config.handler as SubscriberDefinition['handler'],
  }
}

function isEventList(event: EventRef | readonly EventRef[]): event is readonly EventRef[] {
  return Array.isArray(event)
}
