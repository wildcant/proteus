import type { FileDTO } from '@core/types/file/common.js'
import type { CreateFileDTO } from '@core/types/file/mutations.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'

type UploadFilesInput = {
  files: CreateFileDTO[]
}

export const uploadFilesWorkflow = createWorkflow<UploadFilesInput, FileDTO[]>('upload-files', async (ctx, input) => {
  const created = await ctx.step(
    'create-files',
    async ({ container }) => {
      const fileService = container.resolve(Modules.FILE)
      return fileService.createFiles(input.files)
    },
    async (createdFiles, { container }) => {
      const fileService = container.resolve(Modules.FILE)
      await fileService.deleteFiles(createdFiles.map((file) => file.id))
    },
  )

  return created
})
