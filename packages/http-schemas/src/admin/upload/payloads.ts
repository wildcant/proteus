import { i18n } from '@proteus/utils'
import { z } from 'zod'
import { MAX_ITEMS, shortText } from '../../bounded.js'

export const AdminCreatePresignedUploadUrl = z
  .object({
    originalName: shortText.min(1),
    // Anchored at both ends and length-bounded per RFC 6838. Without the trailing
    // anchor a valid prefix carries arbitrary input through to the MIME parser.
    // Both cases are spelled out rather than using the `i` flag, which leaks into
    // the generated OpenAPI `pattern` as a literal "/i" suffix. The `shortText`
    // ceiling matches the 255 the pattern itself allows, and is what puts a
    // `maxLength` in the spec — a `pattern` alone does not satisfy the ruleset.
    mimeType: shortText.regex(
      /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}$/,
      i18n.t('Invalid MIME type'),
    ),
    size: z.number().int().positive(),
    access: z.enum(['public', 'private']).optional(),
  })
  .openapi('AdminCreatePresignedUploadUrl')
export type AdminCreatePresignedUploadUrlBody = z.infer<typeof AdminCreatePresignedUploadUrl>

// `z.file()` has no OpenAPI mapping of its own; the override emits the binary
// string form that multipart/form-data request bodies are specified with.
//
// The non-file fields of the form, which the handler reads as its body. `private` keeps a file off
// public URLs — a catalogue CSV for an import, say — and is served only through presigned links.
export const AdminUploadFilesFields = z.object({
  access: z.enum(['public', 'private']).default('public'),
})

export const AdminUploadFiles = AdminUploadFilesFields.extend({
  files: z.array(z.file().openapi({ type: 'string', format: 'binary' })).max(MAX_ITEMS.small),
}).openapi('AdminUploadFiles')
export type AdminUploadFilesBody = z.infer<typeof AdminUploadFiles>
