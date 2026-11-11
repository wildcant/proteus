import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminApplyCatalogStructure, AdminCatalogStructureResponse } from '@proteus/http-schemas/admin'

export const PostInput = { body: AdminApplyCatalogStructure }
export const PostOutput = AdminCatalogStructureResponse
// an unknown `fileId` is the file provider's NOT_FOUND
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [ErrorTypes.NOT_FOUND] as const

/**
 * Reads an uploaded structure file against the catalogue and the store's menu, and answers with what
 * applying it would do. Writes nothing; a file with errors answers 200 with them, so the admin can
 * list every one.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const fileService = req.scope.resolve(Modules.FILE)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const storeService = req.scope.resolve(Modules.STORE)

  const { structure, errors, changes } = await productService.planCatalogStructure(
    await fileService.getDownloadStream(req.body.fileId),
  )
  const store = await storeService.resolveStore()

  return {
    status: 200,
    json: {
      catalogStructure: {
        errors,
        ...changes,
        menu: { current: store?.navigation ?? [], next: structure?.menu ?? [] },
      },
    },
  }
}
