import { test } from '@tests/setup/test-extend.js'
import { defineEvent } from '../../extensions/define-event.js'
import { buildDelivery, buildEvent } from '../events.js'

/**
 * The identity is derived, never supplied — that is the whole reason it exists in this shape. An
 * earlier `emit(name, key, data)` let a call site hand in a key that disagreed with the payload,
 * which defeats dedup *silently*: the publisher looks right, the transport sees two events, the
 * subscriber runs twice.
 */
test.describe('dispatch identity', () => {
  test('is the event name, the resource id and the subscriber name', async ({ expect }) => {
    expect(buildEvent('bus.probe', { id: 'ord_1' }, 'bus-probe').dispatchId).toBe('bus.probe:ord_1:bus-probe')
  })

  test('separates two subscribers on one event, because each is its own delivery', async ({ expect }) => {
    const first = buildEvent('bus.probe', { id: 'ord_1' }, 'bus-probe').dispatchId
    const second = buildEvent('bus.probe', { id: 'ord_1' }, 'other-probe').dispatchId

    expect(first).not.toBe(second)
  })

  test('collapses a repeat of the same event for the same resource', async ({ expect }) => {
    const first = buildEvent('bus.probe', { id: 'ord_1' }, 'bus-probe').dispatchId
    const again = buildEvent('bus.probe', { id: 'ord_1' }, 'bus-probe').dispatchId

    expect(again).toBe(first)
  })

  /**
   * The derived key means *once per resource*, which is right for an order being placed and wrong
   * for an event that can legitimately happen twice to one thing. Without the extractor the second
   * one is deduped into the first with no error and no log line, so it exists before the event that
   * needs it does.
   */
  test('a custom key extractor keeps two firings for one resource apart', async ({ expect }) => {
    const first = buildEvent('bus.probe.repeatable', { id: 'ord_1', attempt: 1 }, 'bus-probe').dispatchId
    const second = buildEvent('bus.probe.repeatable', { id: 'ord_1', attempt: 2 }, 'bus-probe').dispatchId

    expect(first).toBe('bus.probe.repeatable:ord_1:1:bus-probe')
    expect(second).not.toBe(first)
  })

  test('the event a subscriber receives carries its own identity', async ({ expect }) => {
    const event = buildEvent('bus.probe', { id: 'ord_1' }, 'bus-probe')

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

    expect(buildEvent(once, { id: 'q_1' }, 'pisos-dj.mail').dispatchId).toBe(
      'pisos-dj.quote_requested:q_1:pisos-dj.mail',
    )
    expect(buildEvent(repeatable, { cityId: 'bog', version: 2 }, 'pisos-dj.sync').dispatchId).toBe(
      'pisos-dj.rate_changed:bog:2:pisos-dj.sync',
    )

    const readBack = buildDelivery(
      'pisos-dj.rate_changed',
      { cityId: 'bog', version: 2 },
      {
        name: 'pisos-dj.sync',
        keys: { 'pisos-dj.rate_changed': (data) => repeatable.key(data as { cityId: string; version: number }) },
      },
    )
    expect(readBack.dispatchId).toBe('pisos-dj.rate_changed:bog:2:pisos-dj.sync')
  })
})
