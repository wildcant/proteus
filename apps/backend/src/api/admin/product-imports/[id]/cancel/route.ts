import { ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminProductImportResponse, IdParams } from '@proteus/http-schemas/admin'

export const PostInput = { params: IdParams }
export const PostOutput = AdminProductImportResponse
// a job no longer previewed is refused by the module
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [ErrorTypes.NOT_ALLOWED] as const

/** Abandons a previewed import and deletes the uploaded CSV and the chunks read from it. */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productImport = await productService.cancelProductImport(req.params.id)

  // Best effort, after the job is closed: a file left behind costs storage, a job left confirmable
  // with its files gone would fail every product.
  const fileService = req.scope.resolve(Modules.FILE)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  await fileService.deleteFiles([productImport.fileId, ...productImport.chunks]).catch((error) => logger.error(error))

  return { status: 200, json: { productImport } }
}
