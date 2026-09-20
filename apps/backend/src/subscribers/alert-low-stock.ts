import type { SubscriberArgs, SubscriberConfig } from '@core/event-bus/types.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { NotificationTemplates } from '@core/utils/notification-templates.js'
import { env } from '@env'

/**
 * Tells the shopkeeper a variant is running low while they can still reorder it.
 *
 * **The threshold comparison lives here and nowhere else.** Every publisher of
 * `inventory.available_decreased` announces a change without knowing whether it matters, so most
 * deliveries end at the `available > threshold` guard and write nothing. That is the point: one
 * place holds "what counts as low", and adding a fourth publisher costs nothing more than the emit.
 *
 * The level is re-read rather than taken from the payload — the quantities travel as the change's
 * *identity*, so a delivery that arrives after two more writes describes the shelf as it is now
 * rather than as it was. A level that has since been deleted, or a variant whose link is gone, is a
 * delivery about stock nobody holds any more: nothing to say, and nothing to retry.
 *
 * ## Why it is safe to run twice
 *
 * Required to be — the weaker transport is at-least-once with no dedup. The notification's
 * `idempotencyKey` is derived from the event's payload and from nothing minted here, so a repeat
 * delivery of one crossing finds the existing row. It carries the level's write counter for the
 * same reason the dispatch key does: keyed on the level alone a variant would be silenced forever
 * after its first alert, and keyed on the quantities a shelf that dips to 3, is restocked and dips
 * to 3 again would have its second crossing swallowed as a repeat of the first.
 */
async function alertLowStock({ event, container }: SubscriberArgs<'inventory.available_decreased'>) {
  const storeService = container.resolve(Modules.STORE)
  const inventoryService = container.resolve(Modules.INVENTORY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Store-wide and nullable, and a deployment with no store row yet reads the same way an unset
  // threshold does: nothing is ever low, so nothing is ever sent.
  const store = await storeService.resolveStore()
  const threshold = store?.lowStockThreshold ?? null
  if (threshold === null) return

  const [level] = await inventoryService.listInventoryLevels({ id: event.data.id })
  if (!level) {
    logger.debug(`[alert-low-stock] Inventory level "${event.data.id}" no longer exists; nothing to alert about`)
    return
  }

  const available = level.stockedQuantity - level.reservedQuantity
  if (available > threshold) return

  const linkService = container.resolve(ContainerRegistrationKeys.LINK)
  const [link] = await linkService.repo('productVariantInventoryItem').findByInventoryItemIds([level.inventoryItemId])
  if (!link) {
    logger.debug(
      `[alert-low-stock] Inventory item "${level.inventoryItemId}" is linked to no variant; nothing to link the alert to`,
    )
    return
  }

  const productService = container.resolve(Modules.PRODUCT)
  const variant = await productService.retrieveProductVariant(link.variantId)
  const product = await productService.retrieveProduct(variant.productId)

  const notificationService = container.resolve(Modules.NOTIFICATION)
  await notificationService.createNotification({
    // TODO(rbac): one configured address until there is a role to ask for.
    to: env.ADMIN_NOTIFICATION_EMAIL,
    channel: 'feed',
    template: NotificationTemplates.LOW_STOCK,
    data: {
      title: 'Low stock',
      description: `${product.title} (${variant.title}) is down to ${available} ${
        available === 1 ? 'unit' : 'units'
      } available, at or below the ${threshold} you set. Reorder before it sells out.`,
      // The one click the alert exists for: the variant page is where stock is set, so the alert
      // lands on the form that answers it rather than on a list to search.
      href: `/products/${variant.productId}/variants/${variant.id}`,
    },
    triggerType: 'inventory.available_decreased',
    resourceType: 'product_variant',
    resourceId: variant.id,
    // The write counter, not just the level: this crossing, not this level forever.
    idempotencyKey: `low-stock:${event.data.id}:${event.data.version}`,
  })
}

export const config: SubscriberConfig<'inventory.available_decreased'> = {
  name: 'alert-low-stock',
  event: 'inventory.available_decreased',
  handler: alertLowStock,
}
