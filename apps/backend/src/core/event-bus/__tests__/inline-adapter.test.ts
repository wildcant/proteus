import type { Logger } from '@core/types/logger.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { noopLogger } from '../../../framework/logger/noop-logger.js'
import { createInlineEventBus } from '../inline-adapter.js'
import { createSubscriberRegistry } from '../registry.js'
import { defineSubscriber, type SubscriberDefinition } from '../types.js'

function makeContainer() {
  const container = createContainer()
  container.register({ greeting: asValue('hello') })
  return container
}

function makeBus(definitions: SubscriberDefinition[], logger: Logger = noopLogger) {
  return createInlineEventBus({
    registry: createSubscriberRegistry(definitions),
    container: makeContainer(),
    logger,
  })
}

test.describe('the inline event bus', () => {
  test('runs every subscriber that asked for the event', async ({ expect }) => {
    const ran: string[] = []
    const bus = makeBus([
      defineSubscriber({
        name: 'first',
        event: 'bus.probe',
        handler: async () => {
          ran.push('first')
        },
      }),
      defineSubscriber({
        name: 'second',
        event: 'bus.probe',
        handler: async () => {
          ran.push('second')
        },
      }),
    ])

    await bus.emit('bus.probe', { id: 'ord_1' })

    expect(ran.sort()).toEqual(['first', 'second'])
  })

  test('leaves a subscriber that asked for a different event alone', async ({ expect }) => {
    const ran: string[] = []
    const bus = makeBus([
      defineSubscriber({
        name: 'listening',
        event: 'bus.probe',
        handler: async () => {
          ran.push('listening')
        },
      }),
      defineSubscriber({
        name: 'not-listening',
        event: 'bus.probe.repeatable',
        handler: async () => {
          ran.push('not-listening')
        },
      }),
    ])

    await bus.emit('bus.probe', { id: 'ord_1' })

    expect(ran).toEqual(['listening'])
  })

  test('subscribes a handler to every event in an array', async ({ expect }) => {
    const ran: string[] = []
    const bus = makeBus([
      defineSubscriber({
        name: 'both',
        event: ['bus.probe', 'bus.probe.repeatable'],
        handler: async ({ event }) => {
          ran.push(event.name)
        },
      }),
    ])

    await bus.emit('bus.probe', { id: 'ord_1' })
    await bus.emit('bus.probe.repeatable', { id: 'ord_1', attempt: 1 })

    expect(ran).toEqual(['bus.probe', 'bus.probe.repeatable'])
  })

  /**
   * In-process and *awaited*, which is what makes this the seam an arc test can assert through: a
   * caller that has awaited `emit` can read what the subscriber did. A handler left unawaited would
   * still look right for a subscriber whose work is synchronous, and would drop the failure of every
   * one whose work is not — so it is asserted with a handler that cannot finish until this test
   * lets it.
   */
  test('does not resolve until every subscriber has finished', async ({ expect }) => {
    const finished: string[] = []
    let release: () => void = () => undefined
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const bus = makeBus([
      defineSubscriber({
        name: 'slow',
        event: 'bus.probe',
        handler: async () => {
          await blocked
          finished.push('slow')
        },
      }),
    ])

    const emitting = bus.emit('bus.probe', { id: 'ord_1' }).then(() => {
      finished.push('emit')
    })
    await Promise.resolve()
    expect(finished).toEqual([])

    release()
    await emitting

    expect(finished).toEqual(['slow', 'emit'])
  })

  test('hands the subscriber the derived identity and the container', async ({ expect }) => {
    const seen: string[] = []
    const bus = makeBus([
      defineSubscriber({
        name: 'reader',
        event: 'bus.probe',
        handler: async ({ event, container }) => {
          seen.push(event.dispatchId, container.resolve('greeting') as string)
        },
      }),
    ])

    await bus.emit('bus.probe', { id: 'ord_1' })

    expect(seen).toEqual(['bus.probe:ord_1:reader', 'hello'])
  })

  /**
   * The one behaviour this ticket exists to protect. `emit` resolves on acceptance, not on
   * completion: the confirmation send in checkout runs after the payment is authorized, so a
   * failure that reached the publisher would compensate the workflow and refund a valid order over
   * a mail outage. Subscriber failure is the transport's business, and the in-process adapter is
   * still a transport.
   */
  test('does not let a failing subscriber reach the publisher', async ({ expect }) => {
    const logged: string[] = []
    const recording: Logger = {
      ...noopLogger,
      error(messageOrError) {
        logged.push(typeof messageOrError === 'string' ? messageOrError : messageOrError.message)
      },
    }
    const bus = makeBus(
      [
        defineSubscriber({
          name: 'throws',
          event: 'bus.probe',
          handler: async () => {
            throw new Error('the mail provider is down')
          },
        }),
      ],
      recording,
    )

    await expect(bus.emit('bus.probe', { id: 'ord_1' })).resolves.toBeUndefined()
    expect(logged).toContain('[event-bus] Subscriber "throws" failed on "bus.probe:ord_1:throws"')
    expect(logged).toContain('the mail provider is down')
  })

  test('runs the other subscribers when one of them throws', async ({ expect }) => {
    const ran: string[] = []
    const bus = makeBus([
      defineSubscriber({
        name: 'throws',
        event: 'bus.probe',
        handler: async () => {
          throw new Error('boom')
        },
      }),
      defineSubscriber({
        name: 'survives',
        event: 'bus.probe',
        handler: async () => {
          ran.push('survives')
        },
      }),
    ])

    await bus.emit('bus.probe', { id: 'ord_1' })

    expect(ran).toEqual(['survives'])
  })

  test('an event nobody subscribed to is not an error', async ({ expect }) => {
    const bus = makeBus([])

    await expect(bus.emit('bus.probe', { id: 'ord_1' })).resolves.toBeUndefined()
  })
})

test.describe('the subscriber registry', () => {
  /** Two subscribers under one name share a dispatch identity, so one of the two deliveries is lost. */
  test('refuses two subscribers with the same name', async ({ expect }) => {
    const duplicate = () =>
      createSubscriberRegistry([
        defineSubscriber({ name: 'twice', event: 'bus.probe', handler: async () => undefined }),
        defineSubscriber({ name: 'twice', event: 'bus.probe.repeatable', handler: async () => undefined }),
      ])

    expect(duplicate).toThrow('Two subscribers are registered as "twice"')
  })
})
