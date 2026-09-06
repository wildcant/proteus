import type { IFileModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminDeleteFileResponse, AdminFileResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { deleteFilesWorkflow } from '@workflows/file/delete-files.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminFileResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const fileService = req.scope.resolve<IFileModuleService>(Modules.FILE)
  const file = await fileService.retrieveFile(req.params.id)
  return { status: 200, json: { file } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = AdminDeleteFileResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  await deleteFilesWorkflow.run({ ids: [req.params.id] })
  return { status: 200, json: { id: req.params.id, object: 'file', deleted: true } }
}
