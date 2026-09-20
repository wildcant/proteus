import { test } from '@tests/setup/test-extend.js'
import { buildEvent, dispatchIdentity } from '../events.js'

/**
 * The identity is derived, never supplied — that is the whole reason it exists in this shape. An
 * earlier `emit(name, key, data)` let a call site hand in a key that disagreed with the payload,
 * which defeats dedup *silently*: the publisher looks right, the transport sees two events, the
 * subscriber runs twice.
 */
test.describe('dispatch identity', () => {
  test('is the event name, the resource id and the subscriber name', async ({ expect }) => {
    expect(dispatchIdentity('bus.probe', { id: 'ord_1' }, 'bus-probe')).toBe('bus.probe:ord_1:bus-probe')
  })

  test('separates two subscribers on one event, because each is its own delivery', async ({ expect }) => {
    const first = dispatchIdentity('bus.probe', { id: 'ord_1' }, 'bus-probe')
    const second = dispatchIdentity('bus.probe', { id: 'ord_1' }, 'other-probe')

    expect(first).not.toBe(second)
  })

  test('collapses a repeat of the same event for the same resource', async ({ expect }) => {
    const first = dispatchIdentity('bus.probe', { id: 'ord_1' }, 'bus-probe')
    const again = dispatchIdentity('bus.probe', { id: 'ord_1' }, 'bus-probe')

    expect(again).toBe(first)
  })

  /**
   * The derived key means *once per resource*, which is right for an order being placed and wrong
   * for an event that can legitimately happen twice to one thing. Without the extractor the second
   * one is deduped into the first with no error and no log line, so it exists before the event that
   * needs it does.
   */
  test('a custom key extractor keeps two firings for one resource apart', async ({ expect }) => {
    const first = dispatchIdentity('bus.probe.repeatable', { id: 'ord_1', attempt: 1 }, 'bus-probe')
    const second = dispatchIdentity('bus.probe.repeatable', { id: 'ord_1', attempt: 2 }, 'bus-probe')

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
})
