import { ApplicationFailure } from '@temporalio/common'
import type { AwilixContainer } from 'awilix'
import type { Logger } from '../../../core/types/logger.js'
import { ContainerRegistrationKeys } from '../../../core/utils/container.js'
import { serializeError } from '../../temporal/failures.js'
import type { SubscriberRegistry } from '../registry.js'
import { DISPATCH_ACTIVITY_NAME } from './config.js'
import { type DispatchEventInput, SUBSCRIBER_FAILURE_TYPE, type SubscriberFailureDetail } from './types.js'

/**
 * The single Activity the events Worker registers: look the subscriber up, run it, let Temporal
 * record how it went.
 *
 * A factory rather than a module-level export, for the reason the workflow engine's activities are
 * one: the handler needs the DI container, and building it at import time would open a database pool
 * in every process that so much as imports this module.
 */
export type EventActivities = Record<string, (input: DispatchEventInput) => Promise<void>>

export function createEventActivities(deps: {
  container: AwilixContainer
  registry: SubscriberRegistry
}): EventActivities {
  const { container, registry } = deps

  /**
   * Resolved per call rather than once, and tolerated as missing, for the reason the workflow
   * activities do the same: a test builds a container with a handful of registrations, and a missing
   * logger must not be the thing that fails a delivery.
   */
  function log(): Logger | undefined {
    return container.hasRegistration(ContainerRegistrationKeys.LOGGER)
      ? container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      : undefined
  }

  return {
    [DISPATCH_ACTIVITY_NAME]: async (input) => {
      const { subscriber: name, event } = input
      const subscriber = registry.forEvent(event.name).find((candidate) => candidate.name === name)

      // Non-retryable on purpose, exactly as an unknown workflow name is: a subscriber this Worker
      // does not have is a half-rolled-out deploy, and re-running it produces the same answer until
      // the retry budget is gone. The publisher is not waiting, so the honest place for this is a
      // failed activity in the UI with a message naming the subscriber and the event.
      if (!subscriber) {
        throw ApplicationFailure.create({
          type: SUBSCRIBER_FAILURE_TYPE,
          message: `No subscriber is registered as "${name}" for "${event.name}" on this Worker`,
          nonRetryable: true,
        })
      }

      try {
        await subscriber.handler({ event, container })
        log()?.debug(`[event-bus] delivered "${event.dispatchId}"`)
      } catch (error) {
        throw toSubscriberFailure(error, name, event.dispatchId)
      }
    },
  }
}

/**
 * Wraps whatever the subscriber threw in the one failure shape this boundary uses.
 *
 * Retryable, always. `nonRetryable` on the workflow side encodes a business verdict a step reached
 * about a shopper's cart; a subscriber has no such verdict to reach — it is doing work the publisher
 * has already been told was accepted, and the bounded policy on the activity is what decides when to
 * stop trying. The one thing that genuinely must not be retried is the registry lookup above, which
 * happens before the handler runs.
 */
function toSubscriberFailure(error: unknown, subscriber: string, dispatchId: string): ApplicationFailure {
  const detail: SubscriberFailureDetail = { subscriber, dispatchId, error: serializeError(error) }

  return ApplicationFailure.create({
    type: SUBSCRIBER_FAILURE_TYPE,
    message: `subscriber "${subscriber}" failed on "${dispatchId}": ${detail.error.message}`,
    details: [detail],
  })
}
