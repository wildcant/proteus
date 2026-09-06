import { AdminBatchVariantImages, AdminBatchVariantImagesResponse, VariantIdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { batchVariantImagesWorkflow } from '@workflows/product/batch-variant-images.js'

export const PostInput = { params: VariantIdParams, body: AdminBatchVariantImages }
export const PostOutput = AdminBatchVariantImagesResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const { added, removed } = await batchVariantImagesWorkflow.run({
    variantId: req.params.variantId,
    add: req.body.add,
    remove: req.body.remove,
  })

  return { status: 200, json: { added, removed } }
}
