import { buildEvent } from '@core/event-bus/events.js'
import { defineSubscriber } from '@core/event-bus/types.js'
import type { InventoryLevelDTO } from '@core/types/inventory/common.js'
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

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/**
 * One delivery, identical to what an adapter would hand the handler — through `defineSubscriber`,
 * because that erased handler is what every adapter actually invokes.
 *
 * The quantities come from the level as it was at the moment of the change, which is what a
 * publisher carries; the handler re-reads the row rather than trusting them.
 */
function deliver(
  level: Pick<InventoryLevelDTO, 'id' | 'stockedQuantity' | 'reservedQuantity' | 'updatedAt'>,
): Promise<void> {
  return defineSubscriber(config).handler({
    event: buildEvent(
      'inventory.available_decreased',
      {
        id: level.id,
        stockedQuantity: level.stockedQuantity,
        reservedQuantity: level.reservedQuantity,
        updatedAt: level.updatedAt.toISOString(),
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
   * The reason the write's `updatedAt` — not the quantities — is in the alert's key. A variant
   * can dip to 3/0, be restocked, and dip to 3/0 again. If the key were `levelId:3:0`, the second
   * alert would be deduped into the first. `updatedAt` changes on every write, so the two
   * crossings get different keys even though the final shelf looks the same.
   */
  test('alerts again when a restocked variant dips to the same quantities', async ({ factories, service, expect }) => {
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
    expect(lowAgain.stockedQuantity).toBe(3)

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
