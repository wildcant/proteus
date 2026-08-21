import { z } from 'zod'
import { AdminFile } from './entities.js'

export const AdminUploadResponse = z.object({ files: z.array(AdminFile) }).openapi('AdminUploadResponse')
export type AdminUploadResponse = z.input<typeof AdminUploadResponse>

export const AdminFileResponse = z.object({ file: AdminFile }).openapi('AdminFileResponse')
export type AdminFileResponse = z.input<typeof AdminFileResponse>

export const AdminDeleteFileResponse = z
  .object({
    id: z.string(),
    object: z.literal('file'),
    deleted: z.boolean(),
  })
  .openapi('AdminDeleteFileResponse')
export type AdminDeleteFileResponse = z.input<typeof AdminDeleteFileResponse>

export const AdminPresignedUploadUrlResponse = z
  .object({
    url: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    extension: z.string(),
    originalName: z.string(),
  })
  .openapi('AdminPresignedUploadUrlResponse')
export type AdminPresignedUploadUrlResponse = z.input<typeof AdminPresignedUploadUrlResponse>
