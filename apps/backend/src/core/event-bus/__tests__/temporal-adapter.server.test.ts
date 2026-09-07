import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys } from '@core/utils/index.js'
import type { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { createTemporalDevServerEnvironment, TEMPORAL_BOOT_TIMEOUT } from '@tests/setup/temporal-test-env.js'
import { type AwilixContainer, asValue, createContainer } from 'awilix'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { noopLogger } from '../../../framework/logger/noop-logger.js'
import { PAYLOAD_CONVERTER_PATH } from '../../../temporal/config.js'
import type { Event } from '../events.js'
import { createSubscriberRegistry, type SubscriberRegistry } from '../registry.js'
import { createEventActivities } from '../temporal/activities.js'
import { assertStandaloneActivitiesEnabled } from '../temporal/preflight.js'
import { createTemporalEventBus, type TemporalEventBus } from '../temporal-adapter.js'
import { defineSubscriber, type SubscriberDefinition } from '../types.js'

/**
 * The transport end to end: a real Temporal server, a real Worker polling a real task queue, the
 * real payload converter, and the real dispatch activity.
 *
 * The three properties here cannot be asserted anywhere else, because all three are the *server's*
 * behaviour rather than this code's — dedup is an id-reuse policy the server enforces across
 * processes, the retry budget is a policy the server counts down, and priority is a field the server
 * records on the execution. A double or an in-process adapter would be asserting the test's own
 * arithmetic.
 *
 * A full server rather than the time-skipping one the workflow engine's tests boot: standalone
 * activities are not part of what that Java implementation supports. See
 * `tests/setup/temporal-test-env.ts`.
 */

const TEST_TIMEOUT = 60_000

/** This file's own queue, so nothing else on the server can claim its tasks. */
const TASK_QUEUE = 'proteus-events-test'

let testEnv: TestWorkflowEnvironment
let worker: Worker
let workerRun: Promise<void>
let bus: TemporalEventBus
let container: AwilixContainer

/** Every delivery the Worker actually ran, in order. The whole of what these tests observe. */
const delivered: Event[] = []

/**
 * Set by the subscriber once it is *inside* the handler, and called by the test to let it finish.
 *
 * Held in a mutable module binding read through two functions rather than touched directly: the
 * handler that assigns it runs inside the Worker, so control-flow narrowing at a call site would be
 * narrowing against an assignment TypeScript cannot see.
 */
let release: (() => void) | undefined

function slowSubscriberReached(): boolean {
  return release !== undefined
}

/** Lets a blocked slow subscriber finish, and forgets it. Safe to call when nothing is blocked. */
function releaseSlowSubscriber(): void {
  const resolve = release
  release = undefined
  resolve?.()
}

const subscribers: SubscriberDefinition[] = [
  defineSubscriber({
    name: 'recording-probe',
    event: ['bus.probe', 'bus.probe.repeatable'],
    handler: async ({ event }) => {
      delivered.push(event)
      if (event.data.id.startsWith('slow_')) await new Promise<void>((resolve) => (release = resolve))
    },
  }),
  defineSubscriber({
    name: 'second-probe',
    event: 'bus.probe',
    handler: async ({ event }) => {
      delivered.push(event)
    },
  }),
  defineSubscriber({
    name: 'failing-probe',
    event: 'bus.probe.repeatable',
    handler: async ({ event }) => {
      delivered.push(event)
      throw new Error('subscriber blew up')
    },
  }),
]

/** What the Worker knows. The publisher's registry is built per test, so the two can be made to disagree. */
const workerRegistry: SubscriberRegistry = createSubscriberRegistry(subscribers)

function registryOf(...names: string[]): SubscriberRegistry {
  return createSubscriberRegistry(subscribers.filter((subscriber) => names.includes(subscriber.name)))
}

/**
 * A bus publishing into this file's server and queue. `connect` is the injection the adapter offers
 * for exactly this: nothing here reaches `env.TEMPORAL_ADDRESS`.
 */
function busFor(registry: SubscriberRegistry, logger: Logger = noopLogger): TemporalEventBus {
  return createTemporalEventBus({
    registry,
    logger,
    taskQueue: TASK_QUEUE,
    retry: { maximumAttempts: 3, initialInterval: '1ms' },
    priority: { 'bus.probe': 1 },
    startToCloseTimeout: '30 seconds',
    connect: async () => ({ client: testEnv.client, close: async () => undefined }),
  })
}

/** Collects what the adapter logged at error level, so a test can assert it stayed quiet. */
function collectingLogger(errors: string[]): Logger {
  return {
    ...noopLogger,
    error(messageOrError) {
      errors.push(messageOrError instanceof Error ? messageOrError.message : messageOrError)
    },
  }
}

/** Waits for the delivery with this identity to reach a terminal state, whichever one. */
async function settle(dispatchId: string): Promise<void> {
  await testEnv.client.activity
    .getHandle(dispatchId)
    .result()
    .catch(() => undefined)
}

describe('the temporal event bus', () => {
  beforeAll(async () => {
    testEnv = await createTemporalDevServerEnvironment()

    container = createContainer()
    container.register({ [ContainerRegistrationKeys.LOGGER]: asValue(noopLogger) })

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      namespace: testEnv.namespace,
      taskQueue: TASK_QUEUE,
      // The same converter the publisher encodes with. Two encodings of `BigNumber` and `Date` would
      // surface as corrupt payload data rather than as an error, which is why it is shared.
      dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH },
      // No `workflowsPath`: this Worker runs activities only, exactly as the events Worker does.
      activities: createEventActivities({ container, registry: workerRegistry }),
    })
    workerRun = worker.run()
    // Marks it handled, so a shutdown-time rejection cannot surface as an unhandled one.
    void workerRun.catch(() => undefined)

    bus = busFor(workerRegistry)
  }, TEMPORAL_BOOT_TIMEOUT)

  afterAll(async () => {
    releaseSlowSubscriber()
    worker?.shutdown()
    await workerRun?.catch(() => undefined)
    await bus?.close()
    await testEnv?.teardown()
  })

  it(
    'runs one activity execution per event-and-subscriber pair, on the events queue',
    async () => {
      delivered.length = 0

      await bus.emit('bus.probe', { id: 'once_1' })
      await settle('bus.probe:once_1:recording-probe')
      await settle('bus.probe:once_1:second-probe')

      // Two subscribers, two executions. The subscriber name is in the identity precisely so dedup
      // cannot collapse them into one and drop a delivery.
      expect(delivered.map((event) => event.dispatchId).sort()).toEqual([
        'bus.probe:once_1:recording-probe',
        'bus.probe:once_1:second-probe',
      ])
      // The event arrived intact, through the shared payload converter and back out the other side.
      expect(delivered[0]).toMatchObject({ name: 'bus.probe', data: { id: 'once_1' } })

      const description = await testEnv.client.activity.getHandle('bus.probe:once_1:recording-probe').describe()
      expect(description.taskQueue).toBe(TASK_QUEUE)
    },
    TEST_TIMEOUT,
  )

  it(
    'records the priority key and the event name as the fairness key',
    async () => {
      await bus.emit('bus.probe', { id: 'priority_1' })
      const description = await testEnv.client.activity.getHandle('bus.probe:priority_1:recording-probe').describe()

      // `fairnessKey` is what lets one queue serve every event: a flood of one event is dispatched in
      // proportion to its weight rather than in arrival order, so it cannot push an order-critical
      // one behind it.
      expect(description.priority).toMatchObject({ priorityKey: 1, fairnessKey: 'bus.probe' })

      await settle('bus.probe:priority_1:recording-probe')
      await settle('bus.probe:priority_1:second-probe')
    },
    TEST_TIMEOUT,
  )

  it(
    'collapses a second publish into the running execution instead of starting a second one',
    async () => {
      delivered.length = 0
      releaseSlowSubscriber()
      const single = busFor(registryOf('recording-probe'))

      try {
        await single.emit('bus.probe', { id: 'slow_1' })
        // Wait for the Worker to actually be inside the handler, so the second publish is racing a
        // *running* execution — which is the case `idConflictPolicy: USE_EXISTING` decides.
        await waitFor(slowSubscriberReached)

        const first = await testEnv.client.activity.getHandle('bus.probe:slow_1:recording-probe').describe()
        await single.emit('bus.probe', { id: 'slow_1' })
        const second = await testEnv.client.activity.getHandle('bus.probe:slow_1:recording-probe').describe()

        // Same run, not a second one. This is server-side dedup across processes: no idempotency-key
        // table, no read-then-write race between two API processes, just the id.
        expect(second.activityRunId).toBe(first.activityRunId)
      } finally {
        releaseSlowSubscriber()
        await settle('bus.probe:slow_1:recording-probe')
        await single.close()
      }

      expect(delivered.map((event) => event.dispatchId)).toEqual(['bus.probe:slow_1:recording-probe'])
    },
    TEST_TIMEOUT,
  )

  it(
    'does not run a subscriber again for an event it has already delivered',
    async () => {
      delivered.length = 0
      const errors: string[] = []
      const single = busFor(registryOf('second-probe'), collectingLogger(errors))

      try {
        await single.emit('bus.probe', { id: 'dedup_1' })
        await settle('bus.probe:dedup_1:second-probe')

        // The delivery has *succeeded* now. `ALLOW_DUPLICATE_FAILED_ONLY` is what refuses the repeat:
        // a closed-and-successful id may not be reused, so the publisher's second attempt is
        // rejected by the server rather than becoming a second send.
        await single.emit('bus.probe', { id: 'dedup_1' })
        await settle('bus.probe:dedup_1:second-probe')
      } finally {
        await single.close()
      }

      expect(delivered.map((event) => event.dispatchId)).toEqual(['bus.probe:dedup_1:second-probe'])
      // And the refusal is not reported as a failure — it is the mechanism working.
      expect(errors).toEqual([])
    },
    TEST_TIMEOUT,
  )

  it(
    'lets a delivery that burned its whole retry budget be published again',
    async () => {
      delivered.length = 0
      const errors: string[] = []
      const single = busFor(registryOf('failing-probe'), collectingLogger(errors))
      const identity = 'bus.probe.repeatable:republish_1:1:failing-probe'

      try {
        await single.emit('bus.probe.repeatable', { id: 'republish_1', attempt: 1 })
        await settle(identity)

        const failed = await testEnv.client.activity.getHandle(identity).describe()
        expect(failed.status).toBe('FAILED')

        // The permissive half of `ALLOW_DUPLICATE_FAILED_ONLY`, and the reason that policy is not
        // `REJECT_DUPLICATE`: a delivery that exhausted its retries is *not* delivered, so republishing
        // it has to be allowed or the notification retry and the webhook redelivery in later slices
        // have no way back in. The previous test pins the other half — a delivery that succeeded is
        // refused — and neither alone would notice the policy being changed to the other value.
        await single.emit('bus.probe.repeatable', { id: 'republish_1', attempt: 1 })
        await settle(identity)

        const republished = await testEnv.client.activity.getHandle(identity).describe()
        expect(republished.activityRunId).not.toBe(failed.activityRunId)
      } finally {
        await single.close()
      }

      // Three attempts on the first execution, three on the second: the republish is a fresh
      // execution with its own budget, not a continuation of the exhausted one.
      expect(delivered).toHaveLength(6)
      expect(errors).toEqual([])
    },
    TEST_TIMEOUT,
  )

  it(
    'retries a failing subscriber under the bounded policy, and then stops',
    async () => {
      delivered.length = 0
      const single = busFor(registryOf('failing-probe'))

      try {
        await single.emit('bus.probe.repeatable', { id: 'retry_1', attempt: 1 })
        await settle('bus.probe.repeatable:retry_1:1:failing-probe')
      } finally {
        await single.close()
      }

      // Exactly the budget, then done. Bounded is the point: an unbounded policy on a subscriber
      // that sends email is a mail loop, and Temporal reads an absent `maximumAttempts` as unlimited.
      expect(delivered).toHaveLength(3)

      const description = await testEnv.client.activity
        .getHandle('bus.probe.repeatable:retry_1:1:failing-probe')
        .describe()
      expect(description.status).toBe('FAILED')
    },
    TEST_TIMEOUT,
  )

  it(
    'fails without retrying when the Worker has no such subscriber registered',
    async () => {
      // A publisher and a Worker on different deploys. The lookup happens before the handler runs, so
      // there is nothing to repeat — retrying it just burns the budget and delays the failure an
      // operator needs to see.
      const stranger = createSubscriberRegistry([
        defineSubscriber({ name: 'not-on-this-worker', event: 'bus.probe', handler: async () => undefined }),
      ])
      const single = busFor(stranger)

      try {
        await single.emit('bus.probe', { id: 'unknown_1' })
        const failure = await testEnv.client.activity
          .getHandle('bus.probe:unknown_1:not-on-this-worker')
          .result()
          .then(() => undefined)
          .catch((error: unknown) => error)

        // The name and the event are in the message, because that is the whole of what an operator
        // has to go on: nothing awaited this delivery and no route handler will report it.
        expect(causeMessages(failure)).toContain(
          'No subscriber is registered as "not-on-this-worker" for "bus.probe" on this Worker',
        )

        const description = await testEnv.client.activity.getHandle('bus.probe:unknown_1:not-on-this-worker').describe()
        expect(description.status).toBe('FAILED')
        expect(description.attempt).toBe(1)
      } finally {
        await single.close()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'passes the events-worker preflight against a server that has standalone activities',
    async () => {
      // The half of D11's check only a real server can answer. `preflight.test.ts` covers the
      // refusal, which no server in this suite can produce — the CLI dev server has the flag on,
      // which is exactly why a deployment without it was never going to be caught by tests.
      await expect(
        assertStandaloneActivitiesEnabled({
          namespace: testEnv.client.options.namespace,
          describeActivityExecution: (request) => testEnv.client.workflowService.describeActivityExecution(request),
        }),
      ).resolves.toBeUndefined()
    },
    TEST_TIMEOUT,
  )
})

/** The classes are the SDK's, so the chain is walked structurally rather than with `instanceof`. */
function causeMessages(error: unknown): string[] {
  const messages: string[] = []
  let current: unknown = error
  while (current instanceof Error && messages.length < 8) {
    messages.push(current.message)
    current = current.cause
  }
  return messages
}

/** Polls a condition the Worker satisfies from another task. Cheaper than plumbing a signal out. */
async function waitFor(condition: () => boolean, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the Worker to reach the subscriber')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}
