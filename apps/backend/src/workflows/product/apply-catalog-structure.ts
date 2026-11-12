import { ErrorTypes } from '@core/errors/app-error.js'
import type { CatalogStructureChangesDTO } from '@core/types/product/common.js'
import type { StoreNavigationEntryDTO } from '@core/types/store/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { NO_STORE_CONFIGURED } from '@workflows/store/utils/store-with-currencies.js'

type ApplyCatalogStructureInput = {
  /** The uploaded structure file, stored private. */
  fileId: string
}

type ApplyCatalogStructureOutput = {
  changes: CatalogStructureChangesDTO
  /** The menu before and after. */
  menu: { current: StoreNavigationEntryDTO[]; next: StoreNavigationEntryDTO[] }
}

/**
 * Applies a structure file: the store's menu, then the Categories and Collections. The file is the
 * source, so groupings it leaves out are deleted.
 *
 * The menu goes first because it is the step that can be undone: the groupings are the product
 * module's single transaction and the last step, so when they fail nothing of theirs is left, and
 * the menu is put back. A menu briefly naming a Category not yet created is harmless — the store
 * skips a handle that names nothing live.
 */
export const applyCatalogStructureWorkflow = createWorkflow<ApplyCatalogStructureInput, ApplyCatalogStructureOutput>(
  {
    name: 'apply-catalog-structure',
    // an unknown `fileId` is the file provider's NOT_FOUND
    throws: [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_FOUND],
  },
  async (ctx, input) => {
    const structure = await ctx.step('read-catalog-structure', async ({ container }) => {
      const fileService = container.resolve(Modules.FILE)
      const productService = container.resolve(Modules.PRODUCT)
      const plan = await productService.planCatalogStructure(await fileService.getDownloadStream(input.fileId))
      if (!plan.structure) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t('The structure file has errors. Preview it to see them, fix them and upload it again.'),
        })
      }
      return plan.structure
    })

    const navigation = await ctx.step(
      'set-store-navigation',
      async ({ container }) => {
        const storeService = container.resolve(Modules.STORE)
        const store = await storeService.resolveStore()
        if (!store) throw new WorkflowTerminalError({ type: ErrorTypes.NOT_FOUND, message: NO_STORE_CONFIGURED })
        await storeService.updateStores([store.id], { navigation: structure.menu })
        return { storeId: store.id, current: store.navigation, next: structure.menu }
      },
      async ({ storeId, current }, { container }) => {
        await container.resolve(Modules.STORE).updateStores([storeId], { navigation: current })
      },
    )

    const changes = await ctx.step('apply-catalog-groupings', async ({ container }) =>
      container.resolve(Modules.PRODUCT).applyCatalogStructure(structure),
    )

    return { changes, menu: navigation }
  },
)
