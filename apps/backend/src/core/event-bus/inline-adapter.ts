import type { AwilixContainer } from 'awilix'
import type { Logger } from '../types/logger.js'
import { buildEvent, type Event } from './events.js'
import type { SubscriberRegistry } from './registry.js'
import type { EventBus } from './types.js'

/**
 * The in-process adapter: it looks the subscribers up and runs them, here, now.
 *
 * A production adapter that happens to also be the test seam — not a mock, exactly as
 * `simple-adapter.ts` is to the Temporal workflow engine. Without it the derived default under
 * vitest would be Temporal and every test touching an emit would need a running server, which
 * `pnpm test` must not require. `__tests__/bus-pin.test.ts` is what stops a suite silently running on
 * something else.
 *
 * ## Subscriber failures stop here
 *
 * A subscriber that throws is logged and nothing else: the failure never reaches the publisher. That
 * is not leniency, it is the contract `emit` advertises — a publisher is told the event was
 * accepted, never how a subscriber got on with it. Propagating it would put a mail provider's
 * outage back inside the checkout workflow, which would compensate and refund a valid order over an
 * email. On a real transport the failure is the transport's to retry; here there is nothing to retry
 * with, so the log is the whole of it.
 *
 * This adapter does wait for its subscribers, which is more than the port promises and is what makes
 * it a seam a test can assert through. Nothing may depend on it: on either real transport `emit`
 * returns with the work still to be delivered.
 *
 * Subscribers run concurrently and each is isolated, so one that throws cannot stop another from
 * running — a bug in a new subscriber must not take out an existing one.
 */
export function createInlineEventBus(deps: {
  registry: SubscriberRegistry
  container: AwilixContainer
  logger: Logger
}): EventBus {
  const { registry, container, logger } = deps

  return {
    async emit(name, data) {
      await Promise.all(
        registry.forEvent(name).map(async (subscriber) => {
          // Caught, not left to escape. `buildEvent` runs a key extractor from `EVENT_KEYS`, which
          // is ordinary code that can throw — and a throw here would reject `emit`, which the port
          // forbids for exactly the reason a subscriber failure is caught below. No extractor can
          // throw today; leaving it uncaught means the first one that can is discovered inside a
          // compensated checkout.
          let event: Event
          try {
            event = buildEvent(name, data, subscriber.name)
          } catch (error) {
            logger.error(`[event-bus] Could not build the delivery of "${name}" to "${subscriber.name}"`)
            logger.error(error instanceof Error ? error : String(error))
            return
          }

          try {
            await subscriber.handler({ event, container })
          } catch (error) {
            logger.error(`[event-bus] Subscriber "${subscriber.name}" failed on "${event.dispatchId}"`)
            logger.error(error instanceof Error ? error : String(error))
          }
        }),
      )
    },
  }
}
