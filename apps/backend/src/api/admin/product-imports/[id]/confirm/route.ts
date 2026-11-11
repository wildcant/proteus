import { ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminProductImportResponse, IdParams } from '@proteus/http-schemas/admin'

export const PostInput = { params: IdParams }
export const PostOutput = AdminProductImportResponse
// a job with errors, past its hour or no longer previewed is refused by the module
// ast-grep-ignore: route-declares-unthrown-error
export const PostThrows = [ErrorTypes.NOT_ALLOWED] as const

/**
 * Starts a previewed import. The job turns `importing` here and the products are written by
 * `run-product-import`, off the request, so this answers 202 at once; poll the job for progress.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const productImport = await productService.confirmProductImport(req.params.id)

  const bus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
  await bus.emit('product.import_confirmed', { id: productImport.id })

  return { status: 202, json: { productImport } }
}
