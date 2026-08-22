import { z } from 'zod'

export const AdminCreatePresignedUploadUrl = z
  .object({
    originalName: z.string().min(1),
    // Anchored at both ends and length-bounded per RFC 6838. Without the trailing
    // anchor a valid prefix carries arbitrary input through to the MIME parser.
    // Both cases are spelled out rather than using the `i` flag, which leaks into
    // the generated OpenAPI `pattern` as a literal "/i" suffix.
    mimeType: z
      .string()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}$/, 'Invalid MIME type'),
    size: z.number().int().positive(),
    access: z.enum(['public', 'private']).optional(),
  })
  .openapi('AdminCreatePresignedUploadUrl')
export type AdminCreatePresignedUploadUrlBody = z.infer<typeof AdminCreatePresignedUploadUrl>

// `z.file()` has no OpenAPI mapping of its own; the override emits the binary
// string form that multipart/form-data request bodies are specified with.
export const AdminUploadFiles = z
  .object({
    files: z.array(z.file().openapi({ type: 'string', format: 'binary' })),
  })
  .openapi('AdminUploadFiles')
export type AdminUploadFilesBody = z.infer<typeof AdminUploadFiles>
