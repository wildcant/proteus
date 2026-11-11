import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminCreateProductImport, AdminProductImportResponse } from '@proteus/http-schemas/admin'
import { i18n } from '@proteus/utils'
import { createProductImportWorkflow } from '@workflows/product/create-product-import.js'

export const PostInput = { body: AdminCreateProductImport }
export const PostOutput = AdminProductImportResponse
export const PostThrows = [...createProductImportWorkflow.throws, ErrorTypes.FORBIDDEN] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const { fileId, overwrite, publish } = req.body
  // Overwriting edits products that already exist, which creating alone does not license.
  if (overwrite && !req.authorizationActor?.grantedFeatures.has('product.update')) {
    throw new AppError({ type: ErrorTypes.FORBIDDEN, message: i18n.t('Insufficient permissions') })
  }

  const productImport = await createProductImportWorkflow.run({
    fileId,
    options: { overwrite, publish },
    createdBy: req.authContext?.actorId ?? null,
  })
  return { status: 201, json: { productImport } }
}
