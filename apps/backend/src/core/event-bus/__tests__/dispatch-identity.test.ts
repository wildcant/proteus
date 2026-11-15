import { test } from '@tests/setup/test-extend.js'
import { defineEvent } from '../../extensions/define-event.js'
import { buildDelivery } from '../events.js'
import { defineSubscriber } from '../types.js'

/**
 * The identity is derived, never supplied — that is the whole reason it exists in this shape. An
 * earlier `emit(name, key, data)` let a call site hand in a key that disagreed with the payload,
 * which defeats dedup *silently*: the publisher looks right, the transport sees two events, the
 * subscriber runs twice.
 */
test.describe('dispatch identity', () => {
  test('is the event name, the resource id and the subscriber name', async ({ expect }) => {
    expect(buildDelivery('bus.probe', { id: 'ord_1' }, { name: 'bus-probe' }).dispatchId).toBe(
      'bus.probe:ord_1:bus-probe',
    )
  })

  test('separates two subscribers on one event, because each is its own delivery', async ({ expect }) => {
    const first = buildDelivery('bus.probe', { id: 'ord_1' }, { name: 'bus-probe' }).dispatchId
    const second = buildDelivery('bus.probe', { id: 'ord_1' }, { name: 'other-probe' }).dispatchId

    expect(first).not.toBe(second)
  })

  test('collapses a repeat of the same event for the same resource', async ({ expect }) => {
    const first = buildDelivery('bus.probe', { id: 'ord_1' }, { name: 'bus-probe' }).dispatchId
    const again = buildDelivery('bus.probe', { id: 'ord_1' }, { name: 'bus-probe' }).dispatchId

    expect(again).toBe(first)
  })

  /**
   * The derived key means *once per resource*, which is right for an order being placed and wrong
   * for an event that can legitimately happen twice to one thing. Without the extractor the second
   * one is deduped into the first with no error and no log line, so it exists before the event that
   * needs it does.
   */
  test('a custom key extractor keeps two firings for one resource apart', async ({ expect }) => {
    const first = buildDelivery('bus.probe.repeatable', { id: 'ord_1', attempt: 1 }, { name: 'bus-probe' }).dispatchId
    const second = buildDelivery('bus.probe.repeatable', { id: 'ord_1', attempt: 2 }, { name: 'bus-probe' }).dispatchId

    expect(first).toBe('bus.probe.repeatable:ord_1:1:bus-probe')
    expect(second).not.toBe(first)
  })

  test('the event a subscriber receives carries its own identity', async ({ expect }) => {
    const event = buildDelivery('bus.probe', { id: 'ord_1' }, { name: 'bus-probe' })

    expect(event).toEqual({
      name: 'bus.probe',
      data: { id: 'ord_1' },
      dispatchId: 'bus.probe:ord_1:bus-probe',
    })
  })

  /**
   * An extension event is not in the closed map, so its key travels with its declaration. Read back
   * by name — off a queue — the subscriber's `keys` must give the identity the emitting side gave.
   */
  test('an extension event is keyed by its id, or by the key it declared', async ({ expect }) => {
    const once = defineEvent<{ id: string }>({ name: 'pisos-dj.quote_requested' })
    const repeatable = defineEvent<{ cityId: string; version: number }>({
      name: 'pisos-dj.rate_changed',
      key: (data) => `${data.cityId}:${data.version}`,
    })

    // Each subscriber's `keys` carry its events' declarations, the only thing a delivery read back by name has.
    const subscriber = (name: string, event: typeof once | typeof repeatable) =>
      defineSubscriber({ name, event, handler: async () => undefined })

    expect(buildDelivery(once.name, { id: 'q_1' }, subscriber('pisos-dj.mail', once)).dispatchId).toBe(
      'pisos-dj.quote_requested:q_1:pisos-dj.mail',
    )
    expect(
      buildDelivery(repeatable.name, { cityId: 'bog', version: 2 }, subscriber('pisos-dj.sync', repeatable)).dispatchId,
    ).toBe('pisos-dj.rate_changed:bog:2:pisos-dj.sync')
  })
})
