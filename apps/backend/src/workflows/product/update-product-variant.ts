import { ErrorTypes } from '@core/errors/app-error.js'
import type { ProductVariantDTO } from '@core/types/product/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import type { AdminUpdateProductVariantBody } from '@proteus/http-schemas/admin'
import { i18n, type Msgid } from '@proteus/utils'
import { createVariantInventoryStep, type VariantNeedingInventory } from './steps/create-variant-inventory.js'

type UpdateProductVariantInput = {
  variantId: string
  data: AdminUpdateProductVariantBody
}

/**
 * What the tracking toggle moved, kept so the compensation can move it back.
 *
 * `variantsNeedingInventory` is the one case restoring cannot answer: a variant created untracked
 * has nothing hidden to bring back, so turning tracking on has to make its inventory from scratch.
 */
type SyncVariantInventoryResult = {
  untracked: { linkIds: string[]; inventoryItemIds: string[] }
  restored: { linkIds: string[]; inventoryItemIds: string[] }
  variantsNeedingInventory: VariantNeedingInventory[]
}

const NOTHING_MOVED: SyncVariantInventoryResult = {
  untracked: { linkIds: [], inventoryItemIds: [] },
  restored: { linkIds: [], inventoryItemIds: [] },
  variantsNeedingInventory: [],
}

export const updateProductVariantWorkflow = createWorkflow<UpdateProductVariantInput, ProductVariantDTO>(
  { name: 'update-product-variant', throws: [ErrorTypes.NOT_ALLOWED] },
  async (ctx, input) => {
    const { variant, wasTracked } = await ctx.step(
      'update-variant',
      async ({ container }) => {
        const productService = container.resolve(Modules.PRODUCT)
        const previous = await productService.retrieveProductVariant(input.variantId)
        const variant = await productService.updateProductVariant(input.variantId, input.data)
        return {
          variant,
          wasTracked: previous.manageInventory,
          prevData: { ...previous, variantRank: previous.variantRank ?? undefined },
        }
      },
      async ({ prevData }, { container }) => {
        const productService = container.resolve(Modules.PRODUCT)
        await productService.upsertProductVariants([prevData])
      },
    )

    /**
     * The tracking toggle, made lossless in both directions.
     *
     * Untracking hides the variant's inventory rather than orphaning it, and tracking it again
     * brings the same rows back with the stock number they were hiding. Medusa dismisses the link
     * only — the Inventory Item and its stock are stranded, and re-tracking creates nothing at
     * all, so a variant untracked once can never be tracked again there.
     *
     * Untracking is refused outright while a live reservation stands against the item. The item is
     * about to be hidden and its reservations would be hidden with it, by the same cascade — which
     * would leave a paid order holding units nothing can fulfil, and `reservedQuantity` counting
     * them forever.
     */
    const { variantsNeedingInventory } = await ctx.step<SyncVariantInventoryResult>(
      'sync-variant-inventory-tracking',
      async ({ container }) => {
        if (variant.manageInventory === wasTracked) return NOTHING_MOVED

        const inventoryService = container.resolve(Modules.INVENTORY)
        const linkService = container.resolve(ContainerRegistrationKeys.LINK)

        if (!variant.manageInventory) {
          const links = await linkService.repo('productVariantInventoryItem').findByVariantIds([variant.id])
          if (links.length === 0) return NOTHING_MOVED

          const inventoryItemIds = [...new Set(links.map((link) => link.inventoryItemId))]
          const held = await inventoryService.listReservationItems({ inventoryItemId: inventoryItemIds })
          if (held.length > 0) {
            throw new WorkflowTerminalError({
              type: ErrorTypes.NOT_ALLOWED,
              ...untrackRefusal(variant.id, held),
            })
          }

          const linkIds = links.map((link) => link.id)
          await linkService.repo('productVariantInventoryItem').softDelete(linkIds)
          await inventoryService.softDeleteInventoryItems(inventoryItemIds)

          return { ...NOTHING_MOVED, untracked: { linkIds, inventoryItemIds } }
        }

        const hidden = (
          await linkService.repo('productVariantInventoryItem').find({ variantId: variant.id }, { withDeleted: true })
        ).filter((link) => link.deletedAt !== null)

        if (hidden.length === 0) return { ...NOTHING_MOVED, variantsNeedingInventory: [variant] }

        const linkIds = hidden.map((link) => link.id)
        const inventoryItemIds = [...new Set(hidden.map((link) => link.inventoryItemId))]
        // Restoring the item brings back the levels hidden with it, which is where the stock
        // number the shopkeeper set before untracking has been waiting.
        await inventoryService.restoreInventoryItems(inventoryItemIds)
        await linkService.repo('productVariantInventoryItem').restore(linkIds)

        return { ...NOTHING_MOVED, restored: { linkIds, inventoryItemIds } }
      },
      async (moved, { container }) => {
        const inventoryService = container.resolve(Modules.INVENTORY)
        const linkService = container.resolve(ContainerRegistrationKeys.LINK)

        if (moved.untracked.inventoryItemIds.length > 0) {
          await inventoryService.restoreInventoryItems(moved.untracked.inventoryItemIds)
          await linkService.repo('productVariantInventoryItem').restore(moved.untracked.linkIds)
        }

        if (moved.restored.inventoryItemIds.length > 0) {
          await linkService.repo('productVariantInventoryItem').softDelete(moved.restored.linkIds)
          await inventoryService.softDeleteInventoryItems(moved.restored.inventoryItemIds)
        }
      },
    )

    await createVariantInventoryStep(ctx, { variants: variantsNeedingInventory })

    return variant
  },
)

/** Names what stands in the way, because the shopkeeper's next move is to go and clear it. */
function untrackRefusal(
  variantId: string,
  held: { id: string; quantity: number; lineItemId: string | null }[],
): { message: Msgid; values: Record<string, unknown> } {
  const reservations = held
    .map((reservation) => `"${reservation.id}" (${reservation.quantity} for line item "${reservation.lineItemId}")`)
    .join(', ')

  return {
    message: i18n.t(
      'Variant "{variantId}" cannot stop being tracked while orders hold its stock: reservation(s) {reservations}. Fulfil or cancel them first.',
    ),
    values: { variantId, reservations },
  }
}
