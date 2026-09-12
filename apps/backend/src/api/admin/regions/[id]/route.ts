import type { ILinkService } from '@core/types/link/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminRegionResponse, AdminUpdateRegion, IdParams } from '@proteus/http-schemas/admin'
import { updateRegionWorkflow } from '@workflows/region/update-region.js'
import { regionWithRelations } from '@workflows/region/utils/region-with-relations.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminRegionResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const region = await regionService.retrieveRegion(req.params.id)

  const [countries, links, providers] = await Promise.all([
    regionService.listCountries({ regionId: [region.id] }),
    linkService.repo('regionPaymentProvider').findByRegionIds([region.id]),
    paymentService.listPaymentProviders(),
  ])

  return { status: 200, json: { region: regionWithRelations(region, countries, links, providers) } }
}

export const PostInput = { params: IdParams, body: AdminUpdateRegion }
export const PostOutput = AdminRegionResponse
export const PostThrows = [...updateRegionWorkflow.throws] as const

/**
 * POST rather than PATCH, matching the reference admin this screen is built from: the editor
 * submits the whole form, and `paymentProviderIds` replaces the region's set rather than merging
 * into it. There is deliberately no DELETE — a region owns live carts, orders and prices, and
 * nothing in this feature makes removing one safe.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const region = await updateRegionWorkflow.run({ regionId: req.params.id, ...req.body })

  const [countries, links, providers] = await Promise.all([
    regionService.listCountries({ regionId: [region.id] }),
    linkService.repo('regionPaymentProvider').findByRegionIds([region.id]),
    paymentService.listPaymentProviders(),
  ])

  return { status: 200, json: { region: regionWithRelations(region, countries, links, providers) } }
}
