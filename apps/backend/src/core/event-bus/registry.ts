import { GENERATED_SUBSCRIBERS } from '../../subscribers/registry.gen.js'
import { AppError, ErrorTypes } from '../errors/app-error.js'
import type { EventName } from './events.js'
import type { SubscriberDefinition } from './types.js'

/**
 * Event name → the subscribers that asked for it.
 *
 * The list lives in `src/subscribers/registry.gen.ts` and is written by
 * `npm run --workspace=backend subscribers:generate`, which parses `src/subscribers/` for exported
 * `config` objects. It is a committed file of real static imports, not a runtime directory scan, for
 * the three reasons the workflow registry has the same shape:
 *
 * - **The handler closures have to exist in the process that dispatches.** A transport carries a
 *   subscriber *name*; the function it names is an ordinary closure that exists only because
 *   something imported the module that built it.
 * - **`tsx --watch` reloads off the module graph.** Editing a subscriber restarts the worker because
 *   the graph reaches it; a directory scan is invisible to the watcher.
 * - **`tsc` and `check:structure` can see it.** A dependency-cruiser rule cannot follow a runtime scan,
 *   so the boundary rules that keep a subscriber free of queue vocabulary would have nothing to read.
 *
 * A generated artifact is also identical in every environment because it is in git, and
 * `npm run verify` fails when it drifts from the source tree rather than letting the difference
 * reach a deploy.
 */
export type SubscriberRegistry = {
  forEvent(name: EventName): SubscriberDefinition[]
  names(): string[]
}

export function createSubscriberRegistry(definitions: SubscriberDefinition[]): SubscriberRegistry {
  const byEvent = new Map<EventName, SubscriberDefinition[]>()
  const seen = new Set<string>()

  for (const definition of definitions) {
    // Two subscribers under one name share a dispatch identity, so the transport would collapse
    // their deliveries into one and only whichever ran first would be recorded.
    if (seen.has(definition.name)) {
      throw new AppError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message: `[event-bus] Two subscribers are registered as "${definition.name}"`,
      })
    }
    seen.add(definition.name)

    for (const event of definition.events) {
      const existing = byEvent.get(event)
      if (existing) existing.push(definition)
      else byEvent.set(event, [definition])
    }
  }

  return {
    forEvent: (name) => byEvent.get(name) ?? [],
    names: () => [...seen],
  }
}

export const subscriberRegistry = createSubscriberRegistry(GENERATED_SUBSCRIBERS)
