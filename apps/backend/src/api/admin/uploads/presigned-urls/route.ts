import { MIMEType } from 'node:util'
import type { IFileModuleService } from '@core/types/index.js'
import { AppError, ErrorTypes, Modules } from '@core/utils/index.js'
import { AdminCreatePresignedUploadUrl, AdminPresignedUploadUrlResponse } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { ulid } from 'ulid'

export const PostInput = { body: AdminCreatePresignedUploadUrl }
export const PostOutput = AdminPresignedUploadUrlResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const fileService = req.scope.resolve<IFileModuleService>(Modules.FILE)

  const { originalName, mimeType, size, access = 'public' } = req.body

  // MIMEType throws a bare TypeError on malformed input, which the error handler
  // would surface as a 500. The schema rejects those already; this keeps the
  // parser's stricter view of validity a client error rather than a server one.
  let extension: string
  try {
    extension = new MIMEType(mimeType).subtype
  } catch {
    throw new AppError({ type: ErrorTypes.INVALID_DATA, message: `Invalid MIME type: "${mimeType}"` })
  }
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
