import { AdminUploadResponse } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../server/ports.js'
import { uploadFilesWorkflow } from '../../../workflows/file/upload-files.js'

export const PostOutput = AdminUploadResponse

export const POST = async (req: HttpRequest): Promise<HttpResult<typeof PostOutput>> => {
  const uploadedFiles = req.files ?? []

  const fileData = await Promise.all(
    uploadedFiles.map(async (file) => {
      const buffer = await file.arrayBuffer()
      const content = Buffer.from(buffer).toString('base64')
      return {
        filename: file.name,
        mimeType: file.type,
        content,
        access: 'public' as const,
      }
    }),
  )

  const files = await uploadFilesWorkflow.run({ files: fileData })

  return { status: 200, json: { files } }
}
