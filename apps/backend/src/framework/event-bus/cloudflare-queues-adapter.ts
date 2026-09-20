import type { AwilixContainer } from 'awilix'
import type { DbProvider } from '../../core/db/ports.js'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'
import { buildEvent, type EventName, type EventPayloads } from '../../core/event-bus/events.js'
import type { EventBus } from '../../core/event-bus/types.js'
import type { Logger } from '../../core/types/logger.js'
import type { SubscriberRegistry } from './registry.js'

/**
 * The workerd transport: a published event becomes a queue message, consumed out of the request
 * that caused it.
 *
 * Producer and consumer live in one file because they are two halves of one wire format, and a
 * change to what a message carries has to be made in both at once. Both read the generated
 * registry, so a new file in `src/subscribers/` wires itself into publishing and dispatch with no
 * edit here or at the composition root.
 *
 * Nothing in here is imported by a subscriber, and nothing in here knows what a subscriber does.
 * The function the `queue()` handler calls is the same one the node transport's activity calls —
 * that is the whole point of the split, and it is why this file holds no business vocabulary.
 *
 * ## The guarantee subscribers are written against
 *
 * At-least-once, best-effort ordering, **no dedup**. Cloudflare offers no equivalent of Temporal's
 * `activityId` reuse, so a message can be delivered twice and two deliveries can overlap. That is
 * the weaker of the two transports' contracts and therefore the one every subscriber is written to
 * — `event.dispatchId` is the key to be idempotent against.
 */

/** How large one message may be, from Cloudflare's own limit. */
const MAX_MESSAGE_BYTES = 128 * 1024

/** How many messages `sendBatch` accepts in one call, and how many bytes they may total. */
const MAX_BATCH_MESSAGES = 100
const MAX_BATCH_BYTES = 256 * 1024

/**
 * What crosses the queue: one delivery, to one subscriber.
 *
 * **One message per (event, subscriber) rather than one per event**, which is what makes
 * per-message retry mean "retry that subscriber". A message carrying an event for every subscriber
 * that wanted it would be redelivered whole, so a mail provider being down would re-run the
 * webhook processor next to it.
 *
 * `dispatchId` is deliberately absent: it is derived by `buildEvent` from these three fields and
 * from nothing else, so carrying it would be carrying a second copy of a value that can disagree
 * with the first. The consumer derives it the same way the in-process adapter does, through the one
 * function that is allowed to.
 *
 * The name/data correlation is not expressed in this type because a message read back off a queue
 * is JSON that a previous deploy wrote — the correlation is a fact about the producer, not a
 * property the consumer can rely on the compiler for.
 */
export type QueuedEvent = {
  name: EventName
  data: EventPayloads[EventName]
  subscriber: string
}

/** The producer binding, narrowed to the one method the bus uses. */
export type EventQueueBinding = Pick<Queue<QueuedEvent>, 'sendBatch'>

/**
 * The producer half — the `EventBus` a workerd composition root registers.
 *
 * `emit` resolves once the queue has accepted the messages, which is exactly what the port
 * promises and no more: the subscribers have not run and will not run in this request. A subscriber
 * that throws is this transport's problem to retry and never becomes the publisher's, which is what
 * keeps a mail outage from compensating an authorized checkout.
 *
 * **It does not reject when the send itself fails, either.** An oversized payload, an over-limit
 * batch and a queue that refuses the write all log and resolve. A caller cannot know which runtime
 * it is on, so a rule that held here and not on node would not be a contract — and the caller this
 * is written for is checkout's final step, publishing *after* the payment is authorized, where a
 * rejection compensates the workflow and refunds a valid order. A lost event with a log line is
 * recoverable by replay; a refunded order is not. That is the accepted cost, and the outbox D8 names
 * is what eventually closes it.
 *
 * `queue` is the binding. It is a live object workerd constructs from `wrangler.jsonc` and cannot
 * travel through an environment file, so it is passed in from the composition root rather than read
 * here — and it is typed as possibly missing, because the generated `Env` says it exists on the
 * strength of a config file that a second Worker may not share.
 */
export function createCloudflareQueuesEventBus(deps: {
  queue: EventQueueBinding | undefined
  registry: SubscriberRegistry
  logger: Logger
}): EventBus {
  const { registry, logger } = deps
  const queue = requireQueueBinding(deps.queue)

  return {
    async emit(name, data) {
      const subscribers = registry.forEvent(name)
      // Nothing wanted it. Sending anyway would put a message on the queue that the consumer could
      // only fail to dispatch, and pay a retry cycle and a dead-letter entry to say so.
      if (subscribers.length === 0) return

      try {
        const messages = subscribers.map((subscriber) => ({
          body: { name, data, subscriber: subscriber.name } as QueuedEvent,
        }))

        assertSendable(messages)
        await queue.sendBatch(messages)
      } catch (error) {
        // The publisher is never told, so these lines are the whole trace of a lost event. One per
        // subscriber, because the fan-out travels as a single `sendBatch` and a refusal loses every
        // delivery in it — naming them one at a time is what lets a search for a subscriber find
        // the event it never received. The same sentence the node transport logs, so the search
        // does not have to know which runtime dropped it.
        for (const subscriber of subscribers) {
          logger.error(`[event-bus] Could not dispatch "${name}" to "${subscriber.name}"`)
        }
        logger.error(error instanceof Error ? error : String(error))
      }
    },
  }
}

/**
 * Refuses to build a bus that has no queue to publish to.
 *
 * The generated `Env` types `EVENTS` as always present, on the strength of this app's
 * `wrangler.jsonc` declaring it — which is a claim about one config file, not about the runtime a
 * bundle ends up in. A Worker whose config has no `queues` block hands over `undefined`, and without
 * this the container builds cleanly and dies at the first publish with a `TypeError` about reading
 * `sendBatch` of undefined. That is exactly the *reads as configured, fails at first publish*
 * failure this transport's binding is supposed to be wired against, so it fails at construction
 * instead, naming the binding a reader has to go and add.
 */
function requireQueueBinding(queue: EventQueueBinding | undefined): EventQueueBinding {
  if (!queue || typeof queue.sendBatch !== 'function') {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message:
        '[event-bus] The "EVENTS" queue binding is missing. Declare it under `queues.producers` in ' +
        "this Worker's wrangler.jsonc, or pin `projectConfig.eventBus.adapter` to something that " +
        'does not need one.',
    })
  }

  return queue
}

/**
 * Names a publish the queue would refuse, before it reaches the queue.
 *
 * Cloudflare's answer to an oversized message is an error about bytes, raised at the transport, in
 * a stack that says nothing about which event carried them. Checking here costs one serialisation
 * and buys a message naming the event, the subscriber and the size — which is the difference between
 * a fixable report and an investigation. It throws, and `emit` catches: the value is the sentence,
 * and a sentence is as useful in a log line as in a rejection.
 *
 * The batch ceilings are checked for the same reason, and are refused rather than split: an emit
 * that quietly became two sends would deliver half its subscribers when the second send failed.
 * Neither is reachable at today's fan-out — a handful of subscribers per event, payloads that carry
 * an id — so a failure here means an event's shape changed, and that is worth a loud log line.
 */
function assertSendable(messages: { body: QueuedEvent }[]): void {
  let total = 0

  for (const message of messages) {
    const bytes = new TextEncoder().encode(JSON.stringify(message.body)).length
    total += bytes

    if (bytes > MAX_MESSAGE_BYTES) {
      throw new AppError({
        type: ErrorTypes.INVALID_ARGUMENT,
        message:
          `[event-bus] The payload for "${message.body.name}" is ${bytes} bytes for subscriber ` +
          `"${message.body.subscriber}", over the ${MAX_MESSAGE_BYTES} byte queue message limit. ` +
          'Publish an id and let the subscriber read the rest.',
      })
    }
  }

  if (messages.length > MAX_BATCH_MESSAGES || total > MAX_BATCH_BYTES) {
    const name = messages[0]?.body.name
    throw new AppError({
      type: ErrorTypes.INVALID_ARGUMENT,
      message:
        `[event-bus] "${name}" fans out to ${messages.length} subscribers and ${total} bytes, over ` +
        `the ${MAX_BATCH_MESSAGES} message / ${MAX_BATCH_BYTES} byte queue batch limit.`,
    })
  }
}

/**
 * The consumer half — what `src/index.workerd.ts` exports as `queue()`.
 *
 * Two things here are easy to get wrong and are the reason this adapter has its own tests.
 *
 * **One connection per batch.** A queue message is delivered outside the request that published it,
 * and that request's database connection is already closed — the bug the whole event bus exists to
 * fix. `withConnection` wraps the batch rather than each message: one connection opened and closed
 * per invocation, shared by every subscriber in it.
 *
 * **Ack and retry per message.** A batch is a delivery convenience, not a unit of work. Letting a
 * handler throw out of here would retry the whole batch, so every message that happened to travel
 * alongside a failing one would run a second time — and every subscriber is idempotent, but nothing
 * is free to run repeatedly. Each message is acked or retried on its own, and a failure is logged
 * where it happened rather than surfacing as a batch that died.
 *
 * Messages run concurrently and each is isolated, the same way the in-process adapter isolates
 * subscribers: a bug in a new subscriber must not stop the one next to it from being delivered.
 */
export function createCloudflareQueuesConsumer(deps: {
  registry: SubscriberRegistry
  container: AwilixContainer
  logger: Logger
  dbProvider: Pick<DbProvider, 'withConnection'>
}): (batch: MessageBatch<QueuedEvent>) => Promise<void> {
  const { registry, container, logger, dbProvider } = deps

  return async function consume(batch) {
    await dbProvider.withConnection(async () => {
      await Promise.all(
        batch.messages.map(async (message) => {
          try {
            await dispatch(message.body, { registry, container })
            message.ack()
          } catch (error) {
            // Retried up to `max_retries` in wrangler.jsonc, then dead-lettered. A message naming a
            // subscriber this deploy no longer has takes the same path on purpose: it can never
            // succeed here, and the dead-letter queue is where it stays readable and replayable
            // rather than being acknowledged into nothing.
            logger.error(`[event-bus] Delivery of "${message.body?.name}" to "${message.body?.subscriber}" failed`)
            logger.error(error instanceof Error ? error : String(error))
            message.retry()
          }
        }),
      )
    })
  }
}

/** Runs the one subscriber a message names, or throws so the message retries. */
async function dispatch(body: QueuedEvent, deps: { registry: SubscriberRegistry; container: AwilixContainer }) {
  const { registry, container } = deps
  // Looked up through `forEvent` rather than by name alone, so a message still has to name a
  // subscriber that subscribes to the event it carries.
  const subscriber = registry.forEvent(body.name).find((candidate) => candidate.name === body.subscriber)

  if (!subscriber) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: `[event-bus] No subscriber named "${body.subscriber}" is registered for "${body.name}"`,
    })
  }

  await subscriber.handler({ event: buildEvent(body.name, body.data, subscriber.name), container })
}
