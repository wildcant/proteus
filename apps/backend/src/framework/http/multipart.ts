// The form field multipart uploads must use. Declared in the OpenAPI spec via each
// route's `multipartBody` schema, so parser and published contract stay in step.
const FILES_FIELD = 'files'

/**
 * A multipart form as a handler reads it: the uploads under `files`, and every other text field as
 * the body, which the route's `input.body` validates like a JSON one. A field sent twice keeps its
 * last value.
 */
export async function extractMultipart(request: Request): Promise<{ files: File[]; fields: Record<string, string> }> {
  const formData = await request.formData()
  const files = formData.getAll(FILES_FIELD).filter((value) => value instanceof File)
  const fields: Record<string, string> = {}
  formData.forEach((value, key) => {
    if (key !== FILES_FIELD && typeof value === 'string') fields[key] = value
  })
  return { files, fields }
}
