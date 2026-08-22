import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCreateProductVariantsBatch,
  AdminCreateProductVariantsBatchResponse,
  IdParams,
} from '@proteus/http-schemas/admin'
import { createProductVariantsWorkflow } from '@workflows/product/create-product-variants.js'
import type { HttpRequest, HttpResult } from '../../../../../../server/ports.js'

export const PostInput = { params: IdParams, body: AdminCreateProductVariantsBatch }
export const PostOutput = AdminCreateProductVariantsBatchResponse

/**
 * Creates a whole option matrix in one call. The single-variant POST wraps its body in an array
 * for the same workflow; this exists because the admin's matrix form produces many rows at once
 * and the duplicate-combination check has to see them together.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const created = await createProductVariantsWorkflow.run({
    productId: req.params.id,
    variants: req.body.variants,
  })
  const variants = await productService.enrichVariants(created)
  return { status: 201, json: { variants } }
}
