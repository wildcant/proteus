import { ActivityExecutionAlreadyStartedError, type Client } from '@temporalio/client'
import type { Duration, Priority, RetryPolicy } from '@temporalio/common'
import { AppError, ErrorTypes } from '../errors/app-error.js'
import { createTemporalClient, type TemporalClientHandle } from '../temporal/client.js'
import type { Logger } from '../types/logger.js'
import { buildEvent, type EventName, type EventPayloads } from './events.js'
import type { SubscriberRegistry } from './registry.js'
import {
  DISPATCH_ACTIVITY_NAME,
  EVENTS_TASK_QUEUE,
  MAX_ACTIVITY_ID_LENGTH,
  MAX_FAIRNESS_KEY_BYTES,
} from './temporal/config.js'
import type { DispatchEventInput } from './temporal/types.js'
import type { EventBus } from './types.js'

/**
 * `EventBus` backed by Temporal **standalone activities** — one durable activity execution per
 * (event, subscriber) pair.
 *
 * Not a workflow execution. A workflow's unit is a replayable history, which is a great deal of
 * machinery for "run this function, retry it if it fails". Standalone activities are the smaller
 * unit, and choosing them is what makes `core/event-bus/` and `core/workflows/` genuinely separate
 * rather than separate-by-convention: there is no driver here, no `advanceWorkflow`, no replay and
 * no shape fingerprint, so a change to the workflow engine's replay code is structurally incapable
 * of changing event dispatch.
 *
 * What the server gives us for free, and what would otherwise be hand-written:
 *
 * - **Dedup, across processes.** `activityId` is the derived dispatch identity, with
 *   `idConflictPolicy: USE_EXISTING`. A second publish of the same event to the same subscriber
 *   joins the running execution instead of starting a second one — no idempotency-key table, no
 *   read-then-write race between two API processes.
 * - **Bounded retry**, on the activity's own policy.
 * - **Fairness**, keyed on the event name, so a flood of one event cannot starve another on this
 *   queue.
 * - **A queryable, replayable failure surface** in the Temporal UI.
 *
 * ## `emit` never rejects
 *
 * Not laxity — the port's contract, and load-bearing. A checkout workflow's final step publishes the
 * order confirmation *after* the payment is authorized, so an `emit` that threw would compensate the
 * workflow and refund a valid order because Temporal was briefly unreachable. Everything this
 * adapter can fail at — connecting, deriving the identity, starting the activity — is caught per
 * subscriber and logged at error level, and one subscriber's failed start cannot stop another's.
 *
 * The cost is stated plainly rather than hidden: a start that fails is an event that is **lost**,
 * with a log line as its only trace. That is the same accepted residual D8 records for an emit
 * outside a workflow, and closing it means an outbox table — adapter internals, not a port change.
 */

export type TemporalEventBusOptions = {
  registry: SubscriberRegistry
  logger: Logger
  /**
   * How a failed delivery is retried. Bounded, and refused at construction if it is not.
   *
   * Temporal reads both an absent `maximumAttempts` and `maximumAttempts: 0` as **unlimited**, so a
   * policy written to tune backoff alone — `{ initialInterval: '1s' }` — quietly opts every
   * subscriber into retrying forever. On a subscriber that sends email that is a mail loop, and it
   * arrives by omission rather than by anyone deciding it.
   *
   * This is the rule `createTemporalWorkflowEngine` enforces for step retries, applied again here
   * rather than imported: `core/event-bus/` and `core/workflows/` may not reach each other, and a
   * shared helper is exactly the coupling that rule exists to forbid. The duplication is four lines
   * and it is the point.
   */
  retry?: RetryPolicy
  /**
   * Per-event priority key: 1 is highest, and the server's default maximum is 5. Left unset an
   * event gets `DEFAULT_PRIORITY_KEY`.
   *
   * This is the "an order receipt goes before a catalogue sync" knob. Fairness (below) is the other
   * half and is not configurable — a flood of a *low* priority event still must not monopolise the
   * queue, and that is a property of the transport rather than a per-event choice.
   */
  priority?: Partial<Record<EventName, number>>
  /**
   * How long one delivery attempt may take. Per attempt, not per event.
   *
   * Size it against the slowest subscriber, not the typical one: `.run()` on the workflow port
   * blocks until the workflow finishes, so a subscriber that starts a checkout holds its Worker slot
   * for the whole of it. There is no fire-and-forget through that port today.
   */
  startToCloseTimeout?: Duration
  taskQueue?: string
  /** The ceiling `activityId` is held to; see `MAX_ACTIVITY_ID_LENGTH`. */
  maxActivityIdLength?: number
  /** Supplies the client instead of connecting from `env` — this adapter's own tests use it. */
  connect?: () => Promise<TemporalClientHandle>
}

/**
 * `close()` is additive to the port, for the reason the workflow engine's is: the adapter owns a
 * gRPC connection and the process that built it has to be able to give it back.
 */
export type TemporalEventBus = EventBus & { close: () => Promise<void> }

/** Generous, because a subscriber can be a third-party send or a whole nested workflow. */
const DEFAULT_START_TO_CLOSE_TIMEOUT: Duration = '5 minutes'

/**
 * Modest and bounded. Subscribers are required to be idempotent (the weaker of the two transports
 * has no dedup at all), so repeating one is safe — which is what makes a default retry defensible
 * here where the workflow engine's default is one attempt.
 */
const DEFAULT_RETRY: RetryPolicy = {
  maximumAttempts: 5,
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '1 minute',
}

/** Temporal's own default — `(min + max) / 2` with the default range of 1..5. */
const DEFAULT_PRIORITY_KEY = 3

export function createTemporalEventBus(options: TemporalEventBusOptions): TemporalEventBus {
  assertBoundedRetryPolicy(options.retry)
  assertPriorityKeys(options.priority)

  const { registry, logger } = options
  const taskQueue = options.taskQueue ?? EVENTS_TASK_QUEUE
  const retry = options.retry ?? DEFAULT_RETRY
  const startToCloseTimeout = options.startToCloseTimeout ?? DEFAULT_START_TO_CLOSE_TIMEOUT
  const maxActivityIdLength = options.maxActivityIdLength ?? MAX_ACTIVITY_ID_LENGTH
  const connect = options.connect ?? createTemporalClient

  // Connected on first publish rather than at bootstrap: building the container must not require a
  // reachable Temporal server, or every script and test that only touches the database would.
  let handle: Promise<TemporalClientHandle> | undefined

  async function client(): Promise<Client> {
    // Caching the promise is what makes concurrent first publishes share one connection instead of
    // racing to open several. Caching a *rejected* one would be a different thing entirely: a
    // Temporal that was unreachable at first use would fail every later emit with that same stale
    // error until the process restarted, long after the server came back.
    handle ??= connect().catch((error: unknown) => {
      handle = undefined
      throw error
    })
    return (await handle).client
  }

  async function dispatch<N extends EventName>(name: N, data: EventPayloads[N], subscriber: string): Promise<void> {
    const event = buildEvent(name, data, subscriber)
    const rejected = describeIdentityProblem(event.dispatchId, name, maxActivityIdLength)

    // Checked here rather than left to the server, which answers `Failed to start activity` with
    // the real reason a gRPC layer down. Skipping is not a repair — the event is dropped, loudly —
    // but it names the identity that is too long, which is the thing a reader needs.
    if (rejected) throw new AppError({ type: ErrorTypes.INVALID_DATA, message: rejected })

    const input: DispatchEventInput = { subscriber, event }
    const connected = await client()

    await connected.activity.start(DISPATCH_ACTIVITY_NAME, {
      // The identity *is* the id. That is the whole dedup mechanism: no idempotency-key column, no
      // read-then-write, and it holds across processes because the server owns it.
      id: event.dispatchId,
      taskQueue,
      args: [input],
      startToCloseTimeout,
      retry,
      // Two policies, two different questions. Reuse covers a *closed* activity with this id:
      // a delivery that already succeeded is never repeated, one that failed its whole retry budget
      // may be published again. Conflict covers a *running* one: the second publish joins it.
      idReusePolicy: 'ALLOW_DUPLICATE_FAILED_ONLY',
      idConflictPolicy: 'USE_EXISTING',
      priority: priorityFor(name, options.priority),
      // What the Temporal UI labels the row with, in place of the per-subscriber activity types the
      // workflow engine registers. Nothing dispatches on it.
      summary: `${name} → ${subscriber}`,
    })
  }

  return {
    async emit(name, data) {
      await Promise.all(
        registry.forEvent(name).map(async (subscriber) => {
          try {
            await dispatch(name, data, subscriber.name)
          } catch (error) {
            // Dedup working is not a failure. `ALLOW_DUPLICATE_FAILED_ONLY` refuses a repeat of a
            // delivery that already succeeded, and that refusal is the feature — a webhook Stripe
            // redelivers and a notification retry both publish again on purpose. At error level
            // every correct dedup would read as an incident and bury the ones that are.
            if (error instanceof ActivityExecutionAlreadyStartedError) {
              logger.debug(`[event-bus] "${name}" was already delivered to "${subscriber.name}"; not sending again`)
              return
            }

            // The publisher is never told. See "emit never rejects" above — this log line is the
            // whole trace of a lost event, so it says which event and which subscriber.
            logger.error(`[event-bus] Could not dispatch "${name}" to "${subscriber.name}"`)
            logger.error(error instanceof Error ? error : String(error))
          }
        }),
      )
    },

    async close() {
      const connected = await handle?.catch(() => undefined)
      handle = undefined
      await connected?.close()
    },
  }
}

/**
 * The event name, as the fairness key, plus the configured priority.
 *
 * `fairnessKey` is not configurable and is always the event name: fairness is what lets one queue
 * serve every event, by dispatching each key's tasks in proportion to its weight rather than in
 * arrival order. A thousand queued `product.updated` deliveries therefore cannot push an
 * `order.placed` behind them — which is the property that makes a second queue per event
 * unnecessary.
 */
function priorityFor(name: EventName, configured: TemporalEventBusOptions['priority']): Priority {
  return { priorityKey: configured?.[name] ?? DEFAULT_PRIORITY_KEY, fairnessKey: name }
}

/**
 * Why this dispatch identity cannot be sent, or `undefined` if it can.
 *
 * Both limits are the server's, checked on this side so the failure names the value that broke it.
 * The identity is `${event}:${key}:${subscriber}`, and only `key` is unbounded — it comes from the
 * payload, either as `data.id` or through an `EVENT_KEYS` extractor. A ULID leaves ~200 characters
 * spare; an event whose key is a URL would not.
 */
function describeIdentityProblem(dispatchId: string, name: EventName, maxIdLength: number): string | undefined {
  if (dispatchId.length > maxIdLength) {
    return (
      `[event-bus] The dispatch identity for "${name}" is ${dispatchId.length} characters, over the ` +
      `${maxIdLength} Temporal allows for an activityId, so this event cannot be delivered. ` +
      'Give the event a shorter key through EVENT_KEYS in events.ts — truncating it here would ' +
      `defeat dedup silently. Identity: "${dispatchId}"`
    )
  }

  const fairnessKeyBytes = new TextEncoder().encode(name).length
  if (fairnessKeyBytes > MAX_FAIRNESS_KEY_BYTES) {
    return (
      `[event-bus] The event name "${name}" is ${fairnessKeyBytes} bytes, over the ` +
      `${MAX_FAIRNESS_KEY_BYTES} Temporal allows for a fairness key. Rename the event in events.ts.`
    )
  }

  return undefined
}

/**
 * Refuses a retry policy that does not say, in a number, how many attempts it will make.
 *
 * Deliberately not the workflow engine's `assertBoundedRetryPolicy`, which is the same rule: the
 * two subsystems may not import each other, and "we shared a four-line validator" is how a boundary
 * stops being one. Checked at construction, where the policy is written and where the throw reaches
 * a composition root rather than a shopper — `emit` itself never rejects.
 */
function assertBoundedRetryPolicy(policy: RetryPolicy | undefined): void {
  if (!policy) return

  const attempts = policy.maximumAttempts
  if (typeof attempts === 'number' && Number.isInteger(attempts) && attempts >= 1) return

  throw new AppError({
    type: ErrorTypes.INVALID_DATA,
    message:
      'createTemporalEventBus: retry needs an explicit maximumAttempts of 1 or more. Temporal reads ' +
      `${attempts === undefined ? 'an absent maximumAttempts' : String(attempts)} as unlimited, and ` +
      'a subscriber that sends email retrying forever is a mail loop.',
  })
}

/**
 * A priority key Temporal would reject is a start that fails, and a start that fails is a dropped
 * event with only a log line. Caught at construction instead, where it is a boot failure.
 */
function assertPriorityKeys(priority: TemporalEventBusOptions['priority']): void {
  for (const [event, key] of Object.entries(priority ?? {})) {
    if (typeof key === 'number' && Number.isInteger(key) && key >= 1) continue

    throw new AppError({
      type: ErrorTypes.INVALID_DATA,
      message:
        `createTemporalEventBus: priority["${event}"] must be an integer of 1 or more — 1 is the ` +
        `highest priority and the server's default lowest is 5. Got ${String(key)}.`,
    })
  }
}
