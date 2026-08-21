import type { IFileModuleService } from '@core/types/file/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'

type DeleteFilesInput = {
  ids: string[]
}

export const deleteFilesWorkflow = createWorkflow<DeleteFilesInput, void>('delete-files', async (ctx, input) => {
  await ctx.step('delete-files', async ({ container }) => {
    const fileService = container.resolve<IFileModuleService>(Modules.FILE)
    await fileService.deleteFiles(input.ids)
  })
})
