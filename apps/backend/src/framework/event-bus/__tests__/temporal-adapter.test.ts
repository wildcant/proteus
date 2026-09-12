import type { Logger } from '@core/types/logger.js'
import { ActivityExecutionAlreadyStartedError, type Client } from '@temporalio/client'
import { test } from '@tests/setup/test-extend.js'
import { defineSubscriber } from '../../../core/event-bus/types.js'
import { noopLogger } from '../../../core/logger/noop-logger.js'
import type { TemporalClientHandle } from '../../temporal/client.js'
import { createSubscriberRegistry } from '../registry.js'
import { createTemporalEventBus } from '../temporal-adapter.js'

/**
 * The parts of the adapter that a real server can only show the happy half of: what it refuses to be
 * built with, and what it does when a start fails.
 *
 * `__tests__/temporal-adapter.server.test.ts` is the other half — dedup, retry and priority against
 * a real Temporal, which is the only place those can honestly be asserted. This file needs no server
 * because `connect` is injectable and every property here is about what the adapter does with what
 * it gets back.
 */

const registry = createSubscriberRegistry([
  defineSubscriber({ name: 'first-probe', event: 'bus.probe', handler: async () => undefined }),
  defineSubscriber({ name: 'second-probe', event: 'bus.probe', handler: async () => undefined }),
])

type Started = { id: string; taskQueue: string }

/** Enough of a `Client` for `emit` — it reaches for `activity.start` and nothing else. */
function recordingClient(started: Started[], onStart?: () => void): TemporalClientHandle {
  const client = {
    activity: {
      start: async (_activity: string, options: Started) => {
        onStart?.()
        started.push(options)
        return { activityId: options.id }
      },
    },
  } as unknown as Client

  return { client, close: async () => undefined }
}

function collectingLogger(errors: string[], debug: string[] = []): Logger {
  return {
    ...noopLogger,
    error(messageOrError) {
      errors.push(messageOrError instanceof Error ? messageOrError.message : messageOrError)
    },
    debug(message) {
      debug.push(message)
    },
  }
}

test.describe('the temporal event bus', () => {
  test('starts one activity per subscriber, keyed on that delivery’s identity', async ({ expect }) => {
    const started: Started[] = []
    const bus = createTemporalEventBus({
      registry,
      logger: noopLogger,
      connect: async () => recordingClient(started),
    })

    await bus.emit('bus.probe', { id: 'probe_1' })

    // Two subscribers on one event are two deliveries, never one: the subscriber name is part of the
    // identity precisely so dedup cannot collapse them and drop one.
    expect(started.map((options) => options.id)).toEqual([
      'bus.probe:probe_1:first-probe',
      'bus.probe:probe_1:second-probe',
    ])
    expect(started.every((options) => options.taskQueue === 'proteus-events')).toBe(true)
  })

  test('resolves, and logs, when the transport refuses the start', async ({ expect }) => {
    const errors: string[] = []
    const bus = createTemporalEventBus({
      registry,
      logger: collectingLogger(errors),
      connect: async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:7233')
      },
    })

    // The whole reason this adapter swallows: ILLO-89 puts an `emit` in checkout's final step, after
    // the payment is authorized. A rejection there compensates the workflow and refunds a valid
    // order because Temporal blinked. The event is lost — that is the accepted cost — but the
    // publisher is never told, and the log line is what says so.
    await expect(bus.emit('bus.probe', { id: 'probe_1' })).resolves.toBeUndefined()

    expect(errors).toContain('[event-bus] Could not dispatch "bus.probe" to "first-probe"')
    expect(errors).toContain('[event-bus] Could not dispatch "bus.probe" to "second-probe"')
    expect(errors).toContain('ECONNREFUSED 127.0.0.1:7233')
  })

  test('lets the other subscribers through when one start fails', async ({ expect }) => {
    const started: Started[] = []
    const errors: string[] = []
    let attempts = 0

    const bus = createTemporalEventBus({
      registry,
      logger: collectingLogger(errors),
      connect: async () =>
        recordingClient(started, () => {
          attempts += 1
          if (attempts === 1) throw new Error('activity start rejected')
        }),
    })

    await bus.emit('bus.probe', { id: 'probe_1' })

    // A bug in one subscriber's dispatch must not take out another's, exactly as in the inline
    // adapter — one shared `try` around the loop would lose the second delivery to the first's
    // failure.
    expect(started.map((options) => options.id)).toEqual(['bus.probe:probe_1:second-probe'])
    expect(errors).toContain('[event-bus] Could not dispatch "bus.probe" to "first-probe"')
  })

  test('refuses to send a dispatch identity longer than an activityId may be', async ({ expect }) => {
    const started: Started[] = []
    const errors: string[] = []
    const bus = createTemporalEventBus({
      registry,
      logger: collectingLogger(errors),
      maxActivityIdLength: 40,
      connect: async () => recordingClient(started),
    })

    await bus.emit('bus.probe', { id: 'p'.repeat(64) })

    // Checked here rather than left to the server, which answers `Failed to start activity` with the
    // real reason a gRPC layer down. Truncating instead would be worse than dropping: two different
    // events would share an id and the second would be deduped into the first, silently.
    expect(started).toEqual([])
    expect(errors.some((message) => message.includes('over the 40 Temporal allows for an activityId'))).toBe(true)
  })

  test('does not report a deduped repeat as a failure', async ({ expect }) => {
    const errors: string[] = []
    const debug: string[] = []
    const bus = createTemporalEventBus({
      registry,
      logger: collectingLogger(errors, debug),
      connect: async () => {
        const client = {
          activity: {
            start: async () => {
              throw new ActivityExecutionAlreadyStartedError('already started', 'id', 'run')
            },
          },
        } as unknown as Client
        return { client, close: async () => undefined }
      },
    })

    await bus.emit('bus.probe', { id: 'probe_1' })

    // The refusal is the feature: `ALLOW_DUPLICATE_FAILED_ONLY` is what stops a redelivered webhook
    // or a retried notification from sending twice. At error level every correct dedup would read
    // as an incident, and the failures that are one would be buried in them.
    expect(errors).toEqual([])
    expect(debug).toContain('[event-bus] "bus.probe" was already delivered to "first-probe"; not sending again')
  })

  test('refuses a retry policy that does not bound its attempts', async ({ expect }) => {
    // Temporal reads both of these as unlimited, so a policy meant to tune backoff alone would opt
    // every subscriber into retrying forever — on one that sends email, a mail loop. This is the
    // rule the workflow engine enforces for steps, re-stated here because the two subsystems may not
    // import each other.
    expect(() => createTemporalEventBus({ registry, logger: noopLogger, retry: { initialInterval: '1s' } })).toThrow(
      /retry needs an explicit maximumAttempts/,
    )

    expect(() => createTemporalEventBus({ registry, logger: noopLogger, retry: { maximumAttempts: 0 } })).toThrow(
      /retry needs an explicit maximumAttempts/,
    )

    expect(() => createTemporalEventBus({ registry, logger: noopLogger, retry: { maximumAttempts: 3 } })).not.toThrow()
  })

  test('refuses a priority key the server would reject at start time', async ({ expect }) => {
    // A bad priority key would otherwise surface as a failed start, which this adapter swallows —
    // so every event of that name would vanish with only a log line. A boot failure is the honest
    // place for it.
    expect(() => createTemporalEventBus({ registry, logger: noopLogger, priority: { 'bus.probe': 0 } })).toThrow(
      /priority\["bus.probe"\] must be an integer of 1 or more/,
    )
  })
})
