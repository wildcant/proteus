import type { Logger } from '@core/types/logger.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { defineSubscriber, type SubscriberDefinition } from '../../../core/event-bus/types.js'
import { noopLogger } from '../../../core/logger/noop-logger.js'
import {
  createCloudflareQueuesConsumer,
  createCloudflareQueuesEventBus,
  type QueuedEvent,
} from '../cloudflare-queues-adapter.js'
import { createSubscriberRegistry } from '../registry.js'

/**
 * Against a fake binding under node, the way `core/db/__tests__/workers-provider.test.ts` covers the
 * other half of this runtime. No workerd test pool and no queue: the two behaviours worth protecting
 * are what the adapter does with the binding, not what Cloudflare does with the message.
 *
 * Those two are **ack and retry per message** and **one connection per batch**. Both are silent when
 * wrong — a batch that retries whole still delivers everything eventually, and a consumer sharing a
 * request's connection works right up until the request that opened it has finished, which is every
 * time.
 *
 * The producer half pins the port's other rule: **`emit` never rejects**, on this runtime as on
 * node. `temporal-adapter.test.ts` holds the same assertion against its own transport, so a third
 * one cannot re-open the question by reading only one adapter.
 */

function makeContainer() {
  const container = createContainer()
  container.register({ greeting: asValue('hello') })
  return container
}

/**
 * The producer binding. `sendBatch` is the whole of what the bus asks of a queue.
 *
 * `refuse` makes it answer the way a queue that will not take the write does, which is the half of
 * the never-reject contract no size check can stand in for.
 */
function fakeQueue(options: { refuse?: Error } = {}) {
  const sent: { body: QueuedEvent }[] = []

  return {
    sent,
    binding: {
      async sendBatch(messages: Iterable<{ body: QueuedEvent }>) {
        if (options.refuse) throw options.refuse
        sent.push(...messages)
        return { metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } }
      },
    },
  }
}

function collectingLogger(errors: string[]): Logger {
  return {
    ...noopLogger,
    error(messageOrError) {
      errors.push(messageOrError instanceof Error ? messageOrError.message : messageOrError)
    },
  }
}

/**
 * A delivered batch, plus what each message was left in.
 *
 * `ackAll`/`retryAll` are recorded rather than omitted: the failure this file exists to catch is a
 * consumer that reaches for the batch-wide verbs, and a fake that could not express them would make
 * that failure unrepresentable rather than caught.
 */
function fakeBatch(bodies: QueuedEvent[]) {
  const outcomes = bodies.map((body) => ({ body, acked: false, retried: false }))
  let batchWide = false

  const batch: MessageBatch<QueuedEvent> = {
    messages: outcomes.map((outcome, index) => ({
      id: `msg_${index}`,
      timestamp: new Date(0),
      body: outcome.body,
      attempts: 1,
      ack: () => {
        outcome.acked = true
      },
      retry: () => {
        outcome.retried = true
      },
    })),
    queue: 'proteus-events',
    metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    ackAll: () => {
      batchWide = true
    },
    retryAll: () => {
      batchWide = true
    },
  }

  return {
    batch,
    acked: () => outcomes.filter((o) => o.acked).map((o) => o.body.subscriber),
    retried: () => outcomes.filter((o) => o.retried).map((o) => o.body.subscriber),
    usedBatchWideVerb: () => batchWide,
  }
}

/** Records when a connection is opened and closed, so a test can assert what ran inside one. */
function fakeDbProvider(trace: string[] = []) {
  let connections = 0

  return {
    trace,
    connections: () => connections,
    provider: {
      async withConnection<T>(fn: () => Promise<T>): Promise<T> {
        connections += 1
        trace.push('open')
        try {
          return await fn()
        } finally {
          trace.push('close')
        }
      },
    },
  }
}

function makeConsumer(definitions: SubscriberDefinition[], deps: { logger?: Logger; trace?: string[] } = {}) {
  const db = fakeDbProvider(deps.trace)
  const consume = createCloudflareQueuesConsumer({
    registry: createSubscriberRegistry(definitions),
    container: makeContainer(),
    logger: deps.logger ?? noopLogger,
    dbProvider: db.provider,
  })

  return { consume, db }
}

function message(name: QueuedEvent['name'], data: QueuedEvent['data'], subscriber: string): QueuedEvent {
  return { name, data, subscriber }
}

test.describe('the Cloudflare Queues producer', () => {
  /**
   * One message per (event, subscriber), not one per event. It is what makes a retry retry one
   * subscriber: a message carrying the event for everyone that wanted it would be redelivered whole.
   */
  test('sends one message per subscriber that asked for the event', async ({ expect }) => {
    const queue = fakeQueue()
    const bus = createCloudflareQueuesEventBus({
      queue: queue.binding,
      logger: noopLogger,
      registry: createSubscriberRegistry([
        defineSubscriber({ name: 'first', event: 'bus.probe', handler: async () => undefined }),
        defineSubscriber({ name: 'second', event: 'bus.probe', handler: async () => undefined }),
        defineSubscriber({ name: 'elsewhere', event: 'bus.probe.repeatable', handler: async () => undefined }),
      ]),
    })

    await bus.emit('bus.probe', { id: 'ord_1' })

    expect(queue.sent.map((m) => m.body)).toEqual([
      { name: 'bus.probe', data: { id: 'ord_1' }, subscriber: 'first' },
      { name: 'bus.probe', data: { id: 'ord_1' }, subscriber: 'second' },
    ])
  })

  /** Nothing wanted it, so there is nothing a consumer could do with a message but fail to place it. */
  test('sends nothing when no subscriber asked for the event', async ({ expect }) => {
    const queue = fakeQueue()
    const bus = createCloudflareQueuesEventBus({
      queue: queue.binding,
      logger: noopLogger,
      registry: createSubscriberRegistry([]),
    })

    await expect(bus.emit('bus.probe', { id: 'ord_1' })).resolves.toBeUndefined()
    expect(queue.sent).toEqual([])
  })

  test('does not run a subscriber — the message is consumed out of this request', async ({ expect }) => {
    const ran: string[] = []
    const queue = fakeQueue()
    const bus = createCloudflareQueuesEventBus({
      queue: queue.binding,
      logger: noopLogger,
      registry: createSubscriberRegistry([
        defineSubscriber({
          name: 'later',
          event: 'bus.probe',
          handler: async () => {
            ran.push('later')
          },
        }),
      ]),
    })

    await bus.emit('bus.probe', { id: 'ord_1' })

    expect(ran).toEqual([])
    expect(queue.sent).toHaveLength(1)
  })

  /**
   * The contract, and the mirror of `temporal-adapter.test.ts`'s "resolves, and logs, when the
   * transport refuses the start". A caller cannot know which runtime it is on, so the rule has to be
   * one sentence true of both adapters — and ILLO-89 puts an `emit` in checkout's final step, after
   * the payment is authorized, where a rejection compensates the workflow and refunds a valid order.
   * The event is lost; that is the accepted cost, and these log lines are the whole trace of it.
   */
  test('resolves, and logs, when the queue refuses the send', async ({ expect }) => {
    const errors: string[] = []
    const queue = fakeQueue({ refuse: new Error('Queue "proteus-events" is over its backlog limit') })
    const bus = createCloudflareQueuesEventBus({
      queue: queue.binding,
      logger: collectingLogger(errors),
      registry: createSubscriberRegistry([
        defineSubscriber({ name: 'first-probe', event: 'bus.probe', handler: async () => undefined }),
        defineSubscriber({ name: 'second-probe', event: 'bus.probe', handler: async () => undefined }),
      ]),
    })

    await expect(bus.emit('bus.probe', { id: 'probe_1' })).resolves.toBeUndefined()

    // One line per subscriber, because the fan-out travels as a single sendBatch and a refusal loses
    // every delivery in it — the same sentence the node transport logs, so a search for a lost
    // delivery does not have to know which runtime dropped it.
    expect(errors).toContain('[event-bus] Could not dispatch "bus.probe" to "first-probe"')
    expect(errors).toContain('[event-bus] Could not dispatch "bus.probe" to "second-probe"')
    expect(errors).toContain('Queue "proteus-events" is over its backlog limit')
  })

  /**
   * The queue's own answer to an oversized message is an error about bytes, raised somewhere that
   * says nothing about which event carried them. This one names the event, the subscriber and the
   * size — as useful in a log line as it would have been in a rejection.
   */
  test('logs a payload over the message limit rather than letting the queue reject it', async ({ expect }) => {
    const errors: string[] = []
    const queue = fakeQueue()
    const bus = createCloudflareQueuesEventBus({
      queue: queue.binding,
      logger: collectingLogger(errors),
      registry: createSubscriberRegistry([
        defineSubscriber({ name: 'reader', event: 'bus.probe', handler: async () => undefined }),
      ]),
    })

    await expect(bus.emit('bus.probe', { id: 'x'.repeat(200_000) })).resolves.toBeUndefined()

    expect(queue.sent).toEqual([])
    expect(errors).toContain('[event-bus] Could not dispatch "bus.probe" to "reader"')
    expect(
      errors.some((message) =>
        /"bus\.probe" is \d+ bytes for subscriber "reader", over the 131072 byte queue message limit/.test(message),
      ),
    ).toBe(true)
  })

  test('logs a fan-out over the batch limit rather than delivering half of it', async ({ expect }) => {
    const errors: string[] = []
    const queue = fakeQueue()
    const bus = createCloudflareQueuesEventBus({
      queue: queue.binding,
      logger: collectingLogger(errors),
      registry: createSubscriberRegistry([
        defineSubscriber({ name: 'one', event: 'bus.probe', handler: async () => undefined }),
        defineSubscriber({ name: 'two', event: 'bus.probe', handler: async () => undefined }),
        defineSubscriber({ name: 'three', event: 'bus.probe', handler: async () => undefined }),
      ]),
    })

    await expect(bus.emit('bus.probe', { id: 'x'.repeat(90_000) })).resolves.toBeUndefined()

    expect(queue.sent).toEqual([])
    expect(errors).toContain('[event-bus] Could not dispatch "bus.probe" to "two"')
    expect(
      errors.some((message) =>
        /"bus\.probe" fans out to 3 subscribers and \d+ bytes, over the 100 message \/ 262144 byte queue batch limit/.test(
          message,
        ),
      ),
    ).toBe(true)
  })

  /**
   * The generated `Env` types `EVENTS` as always present because this app's `wrangler.jsonc` says
   * so, which is a claim about one config file rather than about the runtime a bundle ends up in.
   * Without this the container builds cleanly and dies at the first publish with a `TypeError` —
   * the *reads as configured, fails at first publish* failure the binding criterion is written
   * against. It cannot be an `emit`-time log, because a bus that never had a queue never had an
   * event to lose either.
   */
  test('refuses to be built without the EVENTS binding', async ({ expect }) => {
    const build = () =>
      createCloudflareQueuesEventBus({
        queue: undefined,
        logger: noopLogger,
        registry: createSubscriberRegistry([]),
      })

    expect(build).toThrow('[event-bus] The "EVENTS" queue binding is missing')
  })

  test('refuses to be built on a binding that cannot send', async ({ expect }) => {
    const build = () =>
      createCloudflareQueuesEventBus({
        // A KV namespace bound under the same name reads as present and answers nothing.
        queue: {} as never,
        logger: noopLogger,
        registry: createSubscriberRegistry([]),
      })

    expect(build).toThrow('[event-bus] The "EVENTS" queue binding is missing')
  })
})

test.describe('the Cloudflare Queues consumer', () => {
  test('runs the subscriber a message names, with the derived identity and the container', async ({ expect }) => {
    const seen: string[] = []
    const { consume } = makeConsumer([
      defineSubscriber({
        name: 'reader',
        event: 'bus.probe',
        handler: async ({ event, container }) => {
          seen.push(event.name, event.dispatchId, container.resolve('greeting') as string)
        },
      }),
    ])

    await consume(fakeBatch([message('bus.probe', { id: 'ord_1' }, 'reader')]).batch)

    expect(seen).toEqual(['bus.probe', 'bus.probe:ord_1:reader', 'hello'])
  })

  test('leaves the other subscribers on the event alone — a message names exactly one', async ({ expect }) => {
    const ran: string[] = []
    const handler = (name: string) => async () => {
      ran.push(name)
    }
    const { consume } = makeConsumer([
      defineSubscriber({ name: 'addressed', event: 'bus.probe', handler: handler('addressed') }),
      defineSubscriber({ name: 'bystander', event: 'bus.probe', handler: handler('bystander') }),
    ])

    await consume(fakeBatch([message('bus.probe', { id: 'ord_1' }, 'addressed')]).batch)

    expect(ran).toEqual(['addressed'])
  })

  test('acks every message of a batch that succeeded', async ({ expect }) => {
    const { consume } = makeConsumer([
      defineSubscriber({ name: 'works', event: 'bus.probe', handler: async () => undefined }),
    ])
    const delivered = fakeBatch([
      message('bus.probe', { id: 'ord_1' }, 'works'),
      message('bus.probe', { id: 'ord_2' }, 'works'),
    ])

    await consume(delivered.batch)

    expect(delivered.acked()).toEqual(['works', 'works'])
    expect(delivered.retried()).toEqual([])
    expect(delivered.usedBatchWideVerb()).toBe(false)
  })

  /**
   * The assertion the acceptance criterion is about. A handler thrown out of the consumer retries
   * the *batch*, so every message that happened to travel next to a failing one runs again.
   */
  test('retries only the message whose subscriber threw, and acks the rest', async ({ expect }) => {
    const { consume } = makeConsumer([
      defineSubscriber({
        name: 'throws',
        event: 'bus.probe',
        handler: async () => {
          throw new Error('the mail provider is down')
        },
      }),
      defineSubscriber({ name: 'survives', event: 'bus.probe', handler: async () => undefined }),
    ])
    const delivered = fakeBatch([
      message('bus.probe', { id: 'ord_1' }, 'throws'),
      message('bus.probe', { id: 'ord_1' }, 'survives'),
    ])

    await expect(consume(delivered.batch)).resolves.toBeUndefined()

    expect(delivered.retried()).toEqual(['throws'])
    expect(delivered.acked()).toEqual(['survives'])
    expect(delivered.usedBatchWideVerb()).toBe(false)
  })

  test('logs the delivery that failed, so a dead-lettered message has a reason next to it', async ({ expect }) => {
    const logged: string[] = []
    const recording: Logger = {
      ...noopLogger,
      error(messageOrError) {
        logged.push(typeof messageOrError === 'string' ? messageOrError : messageOrError.message)
      },
    }
    const { consume } = makeConsumer(
      [
        defineSubscriber({
          name: 'throws',
          event: 'bus.probe',
          handler: async () => {
            throw new Error('the mail provider is down')
          },
        }),
      ],
      { logger: recording },
    )

    await consume(fakeBatch([message('bus.probe', { id: 'ord_1' }, 'throws')]).batch)

    expect(logged).toContain('[event-bus] Delivery of "bus.probe" to "throws" failed')
    expect(logged).toContain('the mail provider is down')
  })

  /**
   * The original bug the whole feature exists to fix: a queue message is delivered long after the
   * request that published it closed its connection, so the consumer has to open its own — once,
   * for the batch, not once per message.
   */
  test('opens one connection for the whole batch', async ({ expect }) => {
    const { consume, db } = makeConsumer([
      defineSubscriber({ name: 'works', event: 'bus.probe', handler: async () => undefined }),
    ])

    await consume(
      fakeBatch([
        message('bus.probe', { id: 'ord_1' }, 'works'),
        message('bus.probe', { id: 'ord_2' }, 'works'),
        message('bus.probe', { id: 'ord_3' }, 'works'),
      ]).batch,
    )

    expect(db.connections()).toBe(1)
  })

  /** One connection is only the right count if the subscribers actually ran inside it. */
  test('runs every subscriber inside that connection', async ({ expect }) => {
    const trace: string[] = []
    const { consume } = makeConsumer(
      [
        defineSubscriber({
          name: 'works',
          event: 'bus.probe',
          handler: async ({ event }) => {
            trace.push(`handled ${event.data.id}`)
          },
        }),
      ],
      { trace },
    )

    await consume(
      fakeBatch([message('bus.probe', { id: 'ord_1' }, 'works'), message('bus.probe', { id: 'ord_2' }, 'works')]).batch,
    )

    expect(trace[0]).toBe('open')
    expect(trace.at(-1)).toBe('close')
    expect(trace.slice(1, -1).sort()).toEqual(['handled ord_1', 'handled ord_2'])
  })

  /**
   * A message naming a subscriber this deploy no longer has can never succeed, so it retries to the
   * dead-letter queue rather than being acked into nothing — that is where it stays readable and
   * replayable once the rename that stranded it is understood.
   */
  test('retries a message naming a subscriber nothing registers', async ({ expect }) => {
    const { consume } = makeConsumer([
      defineSubscriber({ name: 'renamed', event: 'bus.probe', handler: async () => undefined }),
    ])
    const delivered = fakeBatch([message('bus.probe', { id: 'ord_1' }, 'its-old-name')])

    await expect(consume(delivered.batch)).resolves.toBeUndefined()

    expect(delivered.retried()).toEqual(['its-old-name'])
    expect(delivered.acked()).toEqual([])
  })

  test('retries a message whose subscriber no longer asks for that event', async ({ expect }) => {
    const { consume } = makeConsumer([
      defineSubscriber({ name: 'moved', event: 'bus.probe.repeatable', handler: async () => undefined }),
    ])
    const delivered = fakeBatch([message('bus.probe', { id: 'ord_1' }, 'moved')])

    await consume(delivered.batch)

    expect(delivered.retried()).toEqual(['moved'])
    expect(delivered.acked()).toEqual([])
  })
})
