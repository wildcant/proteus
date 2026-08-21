import { MIMEType } from 'node:util'
import type { IFileModuleService } from '@core/types/index.js'
import { AppError, ErrorTypes, Modules } from '@core/utils/index.js'
import { AdminCreatePresignedUploadUrl, AdminPresignedUploadUrlResponse } from '@proteus/http-schemas/admin'
import { ulid } from 'ulid'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const PostInput = { body: AdminCreatePresignedUploadUrl }
export const PostOutput = AdminPresignedUploadUrlResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const fileService = req.scope.resolve<IFileModuleService>(Modules.FILE)

  const { originalName, mimeType, size, access = 'public' } = req.body

  const mime = new MIMEType(mimeType)
  const extension = mime.subtype
  const filename = `${ulid()}.${extension}`

  const [uploadUrl] = await fileService.getUploadFileUrls([{ filename, access }])
  if (!uploadUrl) {
    throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: 'Failed to generate presigned upload URL' })
  }

  return {
    status: 200,
    json: {
      url: uploadUrl.url,
      filename,
      mimeType,
      size,
      extension,
      originalName,
    },
  }
}
