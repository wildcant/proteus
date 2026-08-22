export function isMultipart(contentType: string | undefined): boolean {
  return contentType?.startsWith('multipart/form-data') ?? false
}
