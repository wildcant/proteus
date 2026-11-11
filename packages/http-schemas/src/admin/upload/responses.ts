import { z } from 'zod'
import { AdminFile } from './entities.js'

export const AdminUploadResponse = z.object({ files: z.array(AdminFile) }).openapi('AdminUploadResponse')
export type AdminUploadResponse = z.input<typeof AdminUploadResponse>

export const AdminFileResponse = z.object({ file: AdminFile }).openapi('AdminFileResponse')
export type AdminFileResponse = z.input<typeof AdminFileResponse>

export const AdminPresignedUploadUrlResponse = z
  .object({
    /** Where to `PUT` the bytes. A relative `/admin/uploads` means the provider takes no direct uploads: post the file there as multipart instead. */
    url: z.string(),
    /** The storage key the object lands at — the file's id once uploaded. */
    fileKey: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    extension: z.string(),
    originalName: z.string(),
  })
  .openapi('AdminPresignedUploadUrlResponse')
export type AdminPresignedUploadUrlResponse = z.input<typeof AdminPresignedUploadUrlResponse>
