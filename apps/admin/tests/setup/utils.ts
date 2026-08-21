const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * A 1x1 PNG for `setInputFiles`, so upload tests need no fixture files on disk. Pass a
 * `mimeType` to exercise the upload allow-list, which only reads the declared type — nothing
 * on either side of the wire decodes the bytes.
 */
export const imageFile = (name: string, mimeType = 'image/png') => ({ name, mimeType, buffer: PNG_1X1 })
