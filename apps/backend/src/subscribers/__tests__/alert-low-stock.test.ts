import { buildEvent } from '@core/event-bus/events.js'
import { defineSubscriber } from '@core/event-bus/types.js'
import type { InventoryLevelDTO } from '@core/types/inventory/common.js'
import type { UserDTO } from '@core/types/user/common.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { config } from '../alert-low-stock.js'

/**
 * The subscriber on its own — what it does with one delivery of `inventory.available_decreased`,
 * separately from the three places that publish it. That they publish at all is covered where each
 * publisher is: `__tests__/complete-cart.test.ts`, `__tests__/create-order-fulfillment.test.ts` and
 * the variant stock route's own spec.
 *
 * The handler is called directly rather than through a bus, for the reason
 * `send-order-confirmation.test.ts` gives: what is under test is the handler, and which adapter
 * would have carried the event is asserted where the transport is.
 */

let container: TestContainer
let operator: UserDTO

/**
 * The alert is addressed to whoever can open the feed and act on the shelf, so a container with no
 * such user would let every "says nothing" spec below pass for the wrong reason. One qualifying
 * operator exists throughout; the specs that care about *who* make their own.
 */
test.beforeEach(async ({ createTestContainer, service }) => {
  container = await createTestContainer()
  operator = await service.create.operator(container, ['notification.read', 'inventory.read'])
})

/**
 * One delivery, identical to what an adapter would hand the handler — through `defineSubscriber`,
 * because that erased handler is what every adapter actually invokes.
 *
 * The quantities come from the level as it was at the moment of the change, which is what a
 * publisher carries; the handler re-reads the row rather than trusting them.
 */
function deliver(
  level: Pick<InventoryLevelDTO, 'id' | 'version' | 'stockedQuantity' | 'reservedQuantity'>,
): Promise<void> {
  return defineSubscriber(config).handler({
    event: buildEvent(
      'inventory.available_decreased',
      {
        id: level.id,
        version: level.version,
        stockedQuantity: level.stockedQuantity,
        reservedQuantity: level.reservedQuantity,
      },
      config.name,
    ),
    container,
  })
}

/**
 * The one store row the subscriber reads its threshold off. `resolveStore` takes the oldest, and
 * the container starts empty, so this is the one every spec here gets back.
 */
async function storeWithThreshold(factories: Fixtures['factories'], lowStockThreshold: number | null) {
  return factories.create.store({ lowStockThreshold })
}

/** A tracked variant holding `stockedQuantity` units, and the level the alert would be about. */
async function variantHolding(service: Fixtures['service'], stockedQuantity: number) {
  const { product } = await service.create.product(container, { title: 'Hoodie' })
  const variant = await service.create.productVariant(container, product.id)
  const { inventoryLevel } = await service.create.variantStock(container, {
    variantId: variant.id,
    level: { stockedQuantity },
  })

  return { product, variant, inventoryLevel }
}

test.describe('the low-stock subscriber', () => {
  test('writes one feed alert, naming the variant and linking to it', async ({ factories, service, expect }) => {
    await using _store = await storeWithThreshold(factories, 5)
    const { product, variant, inventoryLevel } = await variantHolding(service, 3)

    await deliver(inventoryLevel)

    expect(await service.read.notifications(container)).toMatchObject([
      {
        to: operator.email,
        channel: 'feed',
        template: 'low-stock',
        triggerType: 'inventory.available_decreased',
        resourceType: 'product_variant',
        resourceId: variant.id,
        data: {
          title: 'Low stock',
          description: expect.stringContaining(`${product.title} (${variant.title}) is down to 3 units`),
          href: `/products/${product.id}/variants/${variant.id}`,
        },
      },
    ])
  })

  /**
   * Who the alert is for is a permission, not an address, and it is the *pair* — a user holding one
   * half is someone the alert would be noise to, or someone who could not open the feed to read it.
   *
   * The two who qualify also prove the fan-out is real in two ways at once: one row each rather
   * than one row total, and a per-recipient idempotency key, without which the unique index on that
   * column would drop the second row.
   */
  test('writes one alert per operator holding both permissions, and none for a user holding one', async ({
    factories,
    service,
    expect,
  }) => {
    await using _store = await storeWithThreshold(factories, 5)
    // Reaches the same pair through module wildcards rather than exact keys.
    const alsoQualifies = await service.create.operator(container, ['notification.*', 'inventory.*'])
    await service.create.operator(container, ['inventory.read'])
    await service.create.operator(container, ['notification.read'])
    const { inventoryLevel } = await variantHolding(service, 3)

    await deliver(inventoryLevel)

    const notifications = await service.read.notifications(container)
    expect(notifications.map((notification) => notification.to).sort()).toEqual(
      [operator.email, alsoQualifies.email].sort(),
    )
  })

  /**
   * Not advice — the contract. The weaker of the two transports is at-least-once with no dedup, so
   * a second delivery of one crossing is a thing that happens rather than a thing that goes wrong.
   */
  test('alerts once when the same crossing is delivered twice', async ({ factories, service, expect }) => {
    await using _store = await storeWithThreshold(factories, 5)
    const { inventoryLevel } = await variantHolding(service, 3)

    await deliver(inventoryLevel)
    await deliver(inventoryLevel)

    expect(await service.read.notifications(container)).toHaveLength(1)
  })

  /**
   * The reason the alert is keyed on the level's write counter rather than on the numbers it left
   * behind. Keyed on the level alone this would be once-per-level-forever; keyed on the quantities
   * it would be once-per-*shelf-state*-forever, and the second crossing here proves the difference
   * — it dips back to exactly 3/0, byte-identical to the first, so a quantity key would swallow it
   * as a redelivery. A wall-clock stamp has the same hole: nothing in this test waits, and the two
   * writes can land in one millisecond. The counter is bumped by the write, so it cannot collide.
   */
  test('alerts again when a restocked variant dips to the quantities it alerted at before', async ({
    factories,
    service,
    expect,
  }) => {
    await using _store = await storeWithThreshold(factories, 5)
    const { inventoryLevel } = await variantHolding(service, 3)

    await deliver(inventoryLevel)

    const restocked = await service.update.inventoryLevel(
      container,
      inventoryLevel.inventoryItemId,
      inventoryLevel.locationId,
      17,
    )
    const lowAgain = await service.update.inventoryLevel(
      container,
      inventoryLevel.inventoryItemId,
      inventoryLevel.locationId,
      -17,
    )
    expect(restocked.stockedQuantity).toBe(20)

    // The whole point: same shelf, same numbers, different write.
    expect(lowAgain.stockedQuantity).toBe(inventoryLevel.stockedQuantity)
    expect(lowAgain.reservedQuantity).toBe(inventoryLevel.reservedQuantity)
    expect(lowAgain.version).toBeGreaterThan(inventoryLevel.version)

    await deliver(lowAgain)

    expect(await service.read.notifications(container)).toHaveLength(2)
  })

  test('says nothing when the change left the variant above the threshold', async ({ factories, service, expect }) => {
    await using _store = await storeWithThreshold(factories, 5)
    const { inventoryLevel } = await variantHolding(service, 6)

    await deliver(inventoryLevel)

    expect(await service.read.notifications(container)).toHaveLength(0)
  })

  /** Nullable on purpose: a shopkeeper who has set no threshold has asked for no alerts. */
  test('says nothing at all when no threshold is set', async ({ factories, service, expect }) => {
    await using _store = await storeWithThreshold(factories, null)
    const { inventoryLevel } = await variantHolding(service, 0)

    await deliver(inventoryLevel)

    expect(await service.read.notifications(container)).toHaveLength(0)
  })

  /**
   * The quantities travel as the change's identity, not as a snapshot to act on — so a delivery
   * that arrives after the shelf was refilled describes stock that is no longer low, and the
   * handler's re-read is what notices.
   */
  test('re-reads the level, so a late delivery about refilled stock says nothing', async ({
    factories,
    service,
    expect,
  }) => {
    await using _store = await storeWithThreshold(factories, 5)
    const { inventoryLevel } = await variantHolding(service, 3)

    await service.update.inventoryLevel(container, inventoryLevel.inventoryItemId, inventoryLevel.locationId, 50)

    await deliver(inventoryLevel)

    expect(await service.read.notifications(container)).toHaveLength(0)
  })
})
