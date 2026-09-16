import { ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { type ConfirmInventoryResult, prepareConfirmInventoryInput } from './utils/prepare-confirm-inventory-input.js'
import { missingInventoryItemMessage } from './utils/variant-inventory.js'

type ConfirmInventoryInput = { cartId: string }

export const confirmInventoryWorkflow = createWorkflow<ConfirmInventoryInput, ConfirmInventoryResult>(
  { name: 'confirm-inventory', throws: [ErrorTypes.CONFLICT, ErrorTypes.INVALID_DATA] },
  async (ctx, input) => {
    const confirmInput = await ctx.step('prepare-confirm-inventory-input', async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

      const lineItems = await cartService.listLineItems({ cartId: input.cartId })
      logger.debug(`[confirm-inventory] Found ${lineItems.length} line item(s) for cart ${input.cartId}`)

      const variantIds = lineItems.map((li) => li.variantId).filter((id) => id != null)
      /** What the catalogue says about each one: an untracked variant is dropped from the result
       *  below and is never confirmed, and a backorder variant is confirmed against no coverage. */
      const variants = await productService.listProductVariants({ id: variantIds })
      const mappings = await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)
      logger.debug(
        `[confirm-inventory] Found ${mappings.length} variant-inventory mapping(s) for ${variantIds.length} variant(s)`,
      )

      const missingInventoryItem = missingInventoryItemMessage(variants, mappings)
      if (missingInventoryItem) {
        throw new WorkflowTerminalError({ type: ErrorTypes.INVALID_DATA, message: missingInventoryItem })
      }

      const inventoryItemIds = [...new Set(mappings.map((m) => m.inventoryItemId))]
      const levels = await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })
      logger.debug(
        `[confirm-inventory] Found ${levels.length} inventory level(s) for ${inventoryItemIds.length} item(s)`,
      )

      return prepareConfirmInventoryInput({ cartId: input.cartId, lineItems, variants, mappings, levels })
    })

    await ctx.step('confirm-inventory', async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)

      /** A backorder is stock the shop promises before it has it, so it is listed with the rest
       *  and asked to cover nothing. */
      const covered = confirmInput.items.filter((item) => !item.allowBackorder)

      if (!covered.length) {
        logger.debug(`[confirm-inventory] No items to confirm, skipping`)
        return
      }

      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

      const results = await Promise.all(
        covered.map(async (item) => {
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

      logger.debug(`[confirm-inventory] All ${covered.length} item(s) confirmed`)
    })

    return confirmInput
  },
)
