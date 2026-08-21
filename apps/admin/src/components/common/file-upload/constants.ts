/** A MIME type paired with the extension shown to users when a file is rejected. */
export type AcceptedFormat = {
  mimeType: string
  extension: string
}

/** The backend enforces its own (larger) ceiling; this keeps the browser from staging huge blobs. */
export const DEFAULT_MAX_FILE_SIZE = 1024 * 1024

export const IMAGE_FORMATS: AcceptedFormat[] = [
  { mimeType: 'image/jpeg', extension: '.jpeg' },
  { mimeType: 'image/png', extension: '.png' },
  { mimeType: 'image/gif', extension: '.gif' },
  { mimeType: 'image/webp', extension: '.webp' },
  { mimeType: 'image/heic', extension: '.heic' },
  { mimeType: 'image/svg+xml', extension: '.svg' },
]
