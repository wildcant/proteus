import { z } from 'zod'

export const AdminCreatePresignedUploadUrl = z
  .object({
    originalName: z.string().min(1),
    mimeType: z.string().regex(/^[a-z\w][\w!#$&\-^.+]*\/[a-z\w][\w!#$&\-^.+]*/, 'Invalid MIME type'),
    size: z.number().int().positive(),
    access: z.enum(['public', 'private']).optional(),
  })
  .openapi('AdminCreatePresignedUploadUrl')
export type AdminCreatePresignedUploadUrlBody = z.infer<typeof AdminCreatePresignedUploadUrl>
