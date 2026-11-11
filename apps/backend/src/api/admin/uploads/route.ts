import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminUploadFilesFields, AdminUploadResponse } from '@proteus/http-schemas/admin'
import { uploadFilesWorkflow } from '@workflows/file/upload-files.js'

export const PostInput = { body: AdminUploadFilesFields }
export const PostOutput = AdminUploadResponse
export const PostThrows = [...uploadFilesWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const uploadedFiles = req.files ?? []

  const fileData = await Promise.all(
    uploadedFiles.map(async (file) => {
      const buffer = await file.arrayBuffer()
      const content = Buffer.from(buffer).toString('base64')
      return {
        filename: file.name,
        mimeType: file.type,
        content,
        access: req.body.access,
      }
    }),
  )

  const files = await uploadFilesWorkflow.run({ files: fileData })

  return { status: 201, json: { files } }
}
