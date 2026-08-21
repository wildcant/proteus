import { AdminBatchImageVariant, AdminBatchImageVariantResponse, ImageIdParams } from '@proteus/http-schemas/admin'
import { batchImageVariantsWorkflow } from '@workflows/product/batch-image-variants.js'
import type { HttpRequest, HttpResult } from '../../../../../../../../server/ports.js'

export const PostInput = { params: ImageIdParams, body: AdminBatchImageVariant }
export const PostOutput = AdminBatchImageVariantResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const { added, removed } = await batchImageVariantsWorkflow.run({
    imageId: req.params.imageId,
    add: req.body.add,
    remove: req.body.remove,
  })

  return { status: 200, json: { added, removed } }
}
