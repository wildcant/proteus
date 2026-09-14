import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { IStockLocationModuleService } from '@core/types/stock-location/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'
import { buildVariantInventoryItems, type VariantInventorySeed } from '../utils/build-variant-inventory-items.js'

/** A variant to give inventory to, and the flag that decides whether it gets any. */
export type VariantNeedingInventory = VariantInventorySeed & { id: string; manageInventory: boolean }

export type CreateVariantInventoryInput = { variants: VariantNeedingInventory[] }

export type CreateVariantInventoryResult = {
  inventoryItemIds: string[]
  linkIds: string[]
}

const NOTHING_CREATED: CreateVariantInventoryResult = { inventoryItemIds: [], linkIds: [] }

/** Units of stock one unit of the variant consumes. One variant is one item here; a bundle that
 *  draws several is a concept the admin has no way to express yet. */
const REQUIRED_QUANTITY = 1

/**
 * The inventory a tracked variant is born with: an Inventory Item seeded from the variant, the
 * link that points the variant at it, and a level at the shop's one Stock Location holding zero.
 *
 * The level is a deliberate divergence from Medusa, which creates none — its admin has a flow for
 * adding a location to an Inventory Item and ours will not render one. Without it the variant
 * would have nowhere to put a number and no way to become sellable.
 *
 * Untracked variants are dropped here rather than by the caller, and an empty list is a no-op, so
 * the two handlers that call this never have to put a step behind an `if`.
 *
 * A shop with no Stock Location at all — one that has not been seeded — gets the item and the link
 * and a warning. Refusing the variant outright would be the louder answer but not a better one: a
 * tracked variant is already refused at checkout both when it has no Inventory Item and when it is
 * stocked at no location, so the fault surfaces either way, and building the catalogue before the
 * warehouse stays possible.
 */
export async function createVariantInventoryStep(
  ctx: WorkflowContext,
  input: CreateVariantInventoryInput,
): Promise<CreateVariantInventoryResult> {
  return ctx.step<CreateVariantInventoryResult>(
    'create-variant-inventory',
    async ({ container }) => {
      const tracked = input.variants.filter((variant) => variant.manageInventory)
      if (tracked.length === 0) return NOTHING_CREATED

      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const stockLocationService = container.resolve<IStockLocationModuleService>(Modules.STOCK_LOCATION)

      const items = await inventoryService.createInventoryItems(buildVariantInventoryItems(tracked))

      // Paired back by position: the rows come out of the insert in the order they went in, and a
      // variant and the item seeded from it share no key of their own.
      const links = await linkService.repo('productVariantInventoryItem').createMany(
        tracked.flatMap((variant, index) => {
          const item = items[index]
          return item ? [{ variantId: variant.id, inventoryItemId: item.id, requiredQuantity: REQUIRED_QUANTITY }] : []
        }),
      )

      const created = { inventoryItemIds: items.map((item) => item.id), linkIds: links.map((link) => link.id) }

      const [location] = await stockLocationService.listStockLocations(undefined, {
        order: { createdAt: 'ASC' },
        limit: 1,
      })
      if (!location) {
        logger.warn(
          `[create-variant-inventory] ${items.length} inventory item(s) created with no level: the shop has no Stock Location. The variants behind them cannot be sold until one exists.`,
        )
        return created
      }

      await inventoryService.createInventoryLevels(
        items.map((item) => ({ inventoryItemId: item.id, locationId: location.id, stockedQuantity: 0 })),
      )

      return created
    },
    async (created, { container }) => {
      if (created.inventoryItemIds.length === 0) return

      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

      await linkService.repo('productVariantInventoryItem').softDelete(created.linkIds)
      // The levels go with the item: they name it through a cascading foreign key, which is what
      // the soft-delete walker reads.
      await inventoryService.softDeleteInventoryItems(created.inventoryItemIds)
    },
  )
}
