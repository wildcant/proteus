import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { noopLogger } from '../../../framework/logger/noop-logger.js'
import { createInlineEventBus } from '../inline-adapter.js'
import { createSubscriberRegistry, subscriberRegistry } from '../registry.js'
import { defineSubscriber, type SubscriberArgs, type SubscriberConfig } from '../types.js'

/**
 * The half of the contract that is a compile error rather than a failing assertion.
 *
 * Every `@ts-expect-error` below is an assertion enforced by `npm run typecheck`, not by this run:
 * the directive fails the build when the line it marks *stops* being an error, which is what turns
 * "a typo in an event name is a build failure" into something that can regress visibly. vitest sees
 * the same file with the types stripped, so the `test` blocks assert the runtime half.
 */

const container = createContainer()
const bus = createInlineEventBus({ registry: createSubscriberRegistry([]), container, logger: noopLogger })

async function typeAssertions() {
  await bus.emit('bus.probe', { id: 'ord_1' })

  // @ts-expect-error — not in the event map. A typo is a build failure, not an event nobody receives.
  await bus.emit('bus.plobe', { id: 'ord_1' })

  // @ts-expect-error — `bus.probe.repeatable` carries an attempt, and a payload is checked against its name.
  await bus.emit('bus.probe.repeatable', { id: 'ord_1' })

  // @ts-expect-error — `bus.probe` carries no attempt, so an extra field is a mismatch too.
  await bus.emit('bus.probe', { id: 'ord_1', attempt: 1 })
}

/**
 * Leaving the type argument off must not quietly widen the handler to every event in the map. It is
 * a required parameter with no default, so this is the error you get told about.
 */
// @ts-expect-error — SubscriberConfig takes one type argument, and omitting it is not a default.
const widened: SubscriberConfig = {
  name: 'widened',
  event: 'bus.probe',
  handler: async () => undefined,
}

/** The type argument is what decides which events may be listed, and what the handler is handed. */
const mismatched: SubscriberConfig<'bus.probe'> = {
  name: 'mismatched',
  // @ts-expect-error — narrowed to `bus.probe`, so it cannot subscribe to anything else.
  event: 'bus.probe.repeatable',
  handler: async () => undefined,
}

async function narrowed({ event }: SubscriberArgs<'bus.probe' | 'bus.probe.repeatable'>) {
  if (event.name === 'bus.probe.repeatable') return `${event.data.id}:${event.data.attempt}`

  // @ts-expect-error — narrowed to `bus.probe` by the branch above, and that payload has no attempt.
  return `${event.data.id}:${event.data.attempt}`
}

test.describe('the subscriber contract', () => {
  test('normalises a single event name to the list the registry indexes', async ({ expect }) => {
    const definition = defineSubscriber({ name: 'one', event: 'bus.probe', handler: async () => undefined })

    expect(definition).toMatchObject({ name: 'one', events: ['bus.probe'] })
  })

  test('keeps an array of event names as it was written', async ({ expect }) => {
    const definition = defineSubscriber({
      name: 'many',
      event: ['bus.probe', 'bus.probe.repeatable'],
      handler: async () => undefined,
    })

    expect(definition.events).toEqual(['bus.probe', 'bus.probe.repeatable'])
  })

  /**
   * The identity the registry indexes by is the one the config declares — never the filename. A
   * filename-derived identity means renaming a file silently changes the dedup key, so events in
   * flight are re-dispatched to what the transport reads as a brand new subscriber. The generator's
   * half of this is that it refuses a name it cannot read as a string literal.
   */
  test('registers under the name the config declares', async ({ expect }) => {
    expect(subscriberRegistry.names()).toContain('bus-probe')
    expect(subscriberRegistry.forEvent('bus.probe').map((subscriber) => subscriber.name)).toEqual(['bus-probe'])
  })

  test('narrows the payload a handler receives by the event it is on', async ({ expect }) => {
    container.register({ unused: asValue(null) })

    const repeatable = await narrowed({
      event: { name: 'bus.probe.repeatable', data: { id: 'ord_1', attempt: 2 }, dispatchId: 'x' },
      container,
    })

    expect(repeatable).toBe('ord_1:2')
    expect([widened, mismatched].map((config) => config.name)).toEqual(['widened', 'mismatched'])
    await typeAssertions()
  })
})
