// The form field multipart uploads must use. Declared in the OpenAPI spec via each
// route's `multipartBody` schema, so parser and published contract stay in step.
const FILES_FIELD = 'files'

export async function extractFiles(request: Request): Promise<File[]> {
  const formData = await request.formData()
  return formData.getAll(FILES_FIELD).filter((value) => value instanceof File)
}
