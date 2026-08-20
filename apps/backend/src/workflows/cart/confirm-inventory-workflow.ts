import { ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { type ConfirmInventoryResult, prepareConfirmInventoryInput } from './utils/prepare-confirm-inventory-input.js'

type ConfirmInventoryInput = { cartId: string }

export const confirmInventoryWorkflow = createWorkflow<ConfirmInventoryInput, ConfirmInventoryResult>(
  'confirm-inventory',
  async (ctx, input) => {
    const confirmInput = await ctx.step('prepare-confirm-inventory-input', async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

      const lineItems = await cartService.listLineItems({ cartId: input.cartId })
      logger.debug(`[confirm-inventory] Found ${lineItems.length} line item(s) for cart ${input.cartId}`)

      const variantIds = lineItems.map((li) => li.variantId).filter((id) => id != null)
      const mappings = await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)
      logger.debug(
        `[confirm-inventory] Found ${mappings.length} variant-inventory mapping(s) for ${variantIds.length} variant(s)`,
      )

      const inventoryItemIds = [...new Set(mappings.map((m) => m.inventoryItemId))]
      const levels = await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })
      logger.debug(
        `[confirm-inventory] Found ${levels.length} inventory level(s) for ${inventoryItemIds.length} item(s)`,
      )

      return prepareConfirmInventoryInput({ cartId: input.cartId, lineItems, mappings, levels })
    })

    await ctx.step('confirm-inventory', async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)

      if (!confirmInput.items.length) {
        logger.debug(`[confirm-inventory] No items to confirm, skipping`)
        return
      }

      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

      const results = await Promise.all(
        confirmInput.items.map(async (item) => {
          const hasCoverage = await inventoryService.confirmInventory(
            item.inventoryItemId,
            item.locationIds,
            item.quantity * item.requiredQuantity,
          )
          logger.debug(
            `[confirm-inventory] Item ${item.inventoryItemId}: need ${item.quantity * item.requiredQuantity}, covered=${hasCoverage}`,
          )
          return hasCoverage
        }),
      )

      if (results.some((hasCoverage) => !hasCoverage)) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: 'Some variant does not have the required inventory',
        })
      }

      logger.debug(`[confirm-inventory] All ${confirmInput.items.length} item(s) confirmed`)
    })

    return confirmInput
  },
)
