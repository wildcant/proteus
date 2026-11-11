import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminApplyCatalogStructure, AdminCatalogStructureResponse } from '@proteus/http-schemas/admin'
import { applyCatalogStructureWorkflow } from '@workflows/product/apply-catalog-structure.js'

export const PostInput = { body: AdminApplyCatalogStructure }
export const PostOutput = AdminCatalogStructureResponse
export const PostThrows = [...applyCatalogStructureWorkflow.throws] as const

/**
 * Applies an uploaded structure file: the Categories, Collections and menu become the file's, and
 * groupings it leaves out are deleted. The file is read again rather than trusted from a preview,
 * so what is applied is always what the file says against the catalogue as it is now.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const { changes, menu } = await applyCatalogStructureWorkflow.run({ fileId: req.body.fileId })
  return { status: 200, json: { catalogStructure: { errors: [], ...changes, menu } } }
}
