import type { ILinkService, IPricingModuleService, IProductModuleService } from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import {
  AdminProductVariantResponse,
  AdminUpdateProductVariant,
  AdminUpdateProductVariantResponse,
  DeleteResponse,
  VariantIdParams,
} from '@proteus/http-schemas/admin'
import { deleteProductVariantWorkflow } from '@workflows/product/delete-product-variant.js'
import { updateProductVariantWorkflow } from '@workflows/product/update-product-variant.js'
import type { HttpRequest, HttpResult } from '../../../../../../server/ports.js'

export const GetInput = { params: VariantIdParams }
export const GetOutput = AdminProductVariantResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const pricingService = req.scope.resolve<IPricingModuleService>(Modules.PRICING)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const variant = await productService.retrieveProductVariant(req.params.variantId)
  const [variantAndPriceSetLink] = await linkService.repo('productVariantPriceSet').findByVariantIds([variant.id])
  const priceSetId = variantAndPriceSetLink?.priceSetId

  if (!priceSetId) return { status: 200, json: { variant } }

  const prices = await pricingService.listPrices({ priceSetId })

  return { status: 200, json: { variant: { ...variant, prices } } }
}

export const PatchInput = { params: VariantIdParams, body: AdminUpdateProductVariant }
export const PatchOutput = AdminUpdateProductVariantResponse

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const variant = await updateProductVariantWorkflow.run({ variantId: req.params.variantId, data: req.body })
  return { status: 200, json: { variant } }
}

export const DeleteInput = { params: VariantIdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  await deleteProductVariantWorkflow.run({ variantId: req.params.variantId })
  return { status: 200, json: { id: req.params.variantId, deleted: true } }
}
