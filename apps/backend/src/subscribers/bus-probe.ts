import type { SubscriberArgs, SubscriberConfig } from '@core/event-bus/types.js'
import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys } from '@core/utils/index.js'

/**
 * The bus's round trip, the way `pingWorkflow` is the workflow engine's.
 *
 * It exists to be the proof that the arc works end to end — publish, derive the dispatch identity,
 * consult the generated registry, run the function, observe the outcome — without any production
 * behaviour riding on it. The transports do not exist yet, so a real subscriber moved here now would
 * run in-process anyway and the change would be noise rather than evidence.
 *
 * The line it logs carries the dispatch identity, which is the whole assertion in one string: the
 * name it was published under, the key derived from the payload, and this subscriber's own name —
 * none of which any call site supplied.
 */
type ProbeEvent = 'bus.probe' | 'bus.probe.repeatable'

async function busProbe({ event, container }: SubscriberArgs<ProbeEvent>) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  logger.info(`[bus-probe] ${event.dispatchId}`)
}

export const config: SubscriberConfig<ProbeEvent> = {
  name: 'bus-probe',
  event: ['bus.probe', 'bus.probe.repeatable'],
  handler: busProbe,
}
