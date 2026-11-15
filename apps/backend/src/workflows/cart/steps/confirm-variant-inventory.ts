import { ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import {
  missingInventoryItemMessage,
  prepareVariantInventoryChecks,
  type VariantDemand,
} from '../utils/variant-inventory.js'

export const confirmVariantInventoryThrows = [ErrorTypes.CONFLICT, ErrorTypes.INVALID_DATA] as const

/**
 * Confirms the shelf covers what a cart line would hold once a write lands. The caller hands the
 * quantity the line ends up at, not the change — raising a line from one to five is confirmed at
 * five. An empty list is a write that changes no quantity, and confirms nothing.
 */
export async function confirmVariantInventoryStep(ctx: WorkflowContext, demands: VariantDemand[]): Promise<void> {
  await ctx.step('confirm-inventory', async ({ container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    if (!demands.length) return

    const productService = container.resolve(Modules.PRODUCT)
    const linkService = container.resolve(ContainerRegistrationKeys.LINK)
    const inventoryService = container.resolve(Modules.INVENTORY)

    const variantIds = demands.map((demand) => demand.variantId)
    /** Read here rather than handed down by the caller: a step's return value is what a replay
     *  hands back, and the two flags are worth their own read at the point they decide something. */
    const variants = await productService.listProductVariants({ id: variantIds })
    const mappings = await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)

    const missingInventoryItem = missingInventoryItemMessage(variants, mappings)
    if (missingInventoryItem) {
      throw new WorkflowTerminalError({ type: ErrorTypes.INVALID_DATA, ...missingInventoryItem })
    }

    const inventoryItemIds = [...new Set(mappings.map((mapping) => mapping.inventoryItemId))]
    const levels = await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })

    /** A backorder is stock the shop promises before it has it, so it is asked to cover nothing;
     *  an untracked variant never reached this list at all. */
    const checks = prepareVariantInventoryChecks(demands, variants, mappings, levels).filter(
      (check) => !check.allowBackorder,
    )
    if (!checks.length) {
      logger.debug('[confirm-inventory] No stock-managed variants in the write, skipping')
      return
    }

    const covered = await Promise.all(
      checks.map(async (check) => {
        const required = check.quantity * check.requiredQuantity
        const hasCoverage = await inventoryService.confirmInventory(check.inventoryItemId, check.locationIds, required)
        logger.debug(`[confirm-inventory] Variant ${check.variantId}: need ${required}, covered=${hasCoverage}`)
        return hasCoverage
      }),
    )

    if (covered.some((hasCoverage) => !hasCoverage)) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.CONFLICT,
        message: i18n.t('Not enough stock for the requested quantity'),
      })
    }
  })
}
