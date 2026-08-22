import type { IProductModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminImageVariantsResponse, ImageIdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../../../../../server/ports.js'

export const GetInput = { params: ImageIdParams }
export const GetOutput = AdminImageVariantsResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const variants = await productService.listVariantsForImage(req.params.imageId)

  return { status: 200, json: { variants } }
}
