/** A MIME type paired with the extension shown to users when a file is rejected. */
export type AcceptedFormat = {
  mimeType: string
  extension: string
}

/** The backend enforces its own (larger) ceiling; this keeps the browser from staging huge blobs. */
export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024

/** The product import's ceiling: a whole catalogue in one file is far larger than any image. */
export const CSV_MAX_FILE_SIZE = 15 * 1024 * 1024

export const CSV_FORMATS: AcceptedFormat[] = [{ mimeType: 'text/csv', extension: '.csv' }]

export const IMAGE_FORMATS: AcceptedFormat[] = [
  { mimeType: 'image/jpeg', extension: '.jpeg' },
  { mimeType: 'image/png', extension: '.png' },
  { mimeType: 'image/gif', extension: '.gif' },
  { mimeType: 'image/webp', extension: '.webp' },
  { mimeType: 'image/avif', extension: '.avif' },
  { mimeType: 'image/heic', extension: '.heic' },
  { mimeType: 'image/svg+xml', extension: '.svg' },
]
