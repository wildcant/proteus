const TEXT_MIME_PATTERNS = ['text/', 'csv', 'json', 'xml']

function isTextMimeType(mimeType: string): boolean {
  return TEXT_MIME_PATTERNS.some((pattern) => mimeType.includes(pattern))
}

function isValidBase64(content: string): boolean {
  try {
    const decoded = Buffer.from(content, 'base64')
    return decoded.toString('base64') === content
  } catch {
    return false
  }
}

export function decodeFileContent(content: string, mimeType: string): Buffer {
  if (isValidBase64(content)) {
    return Buffer.from(content, 'base64')
  }

  if (isTextMimeType(mimeType)) {
    return Buffer.from(content, 'utf-8')
  }

  return Buffer.from(content, 'binary')
}
