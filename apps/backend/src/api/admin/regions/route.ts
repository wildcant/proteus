import type { ILinkService } from '@core/types/link/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import {
  AdminCreateRegion,
  AdminRegionListParams,
  AdminRegionListResponse,
  AdminRegionResponse,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { createRegionWorkflow } from '@workflows/region/create-region.js'
import { buildRegionView, buildRegionViews } from '@workflows/region/utils/build-region-views.js'

export const GetInput = { query: AdminRegionListParams }
export const GetOutput = AdminRegionListResponse

/**
 * The regions the store sells into, each with its countries and the gateways it takes payment
 * through.
 *
 * The page is cut here rather than in the query: the region module exposes `listRegions` and no
 * counting counterpart, and a store has as many regions as it has markets — a handful — so the
 * read that counts them is the same read the page comes out of.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const { pagination, filters } = req.validatedQuery
  const { offset, limit, order } = pagination

  const matching = await regionService.listRegions(filters, { order: order ?? { name: 'ASC' } })
  const regions = matching.slice(offset, offset + limit)
  const regionIds = regions.map((region) => region.id)

  const [countries, links, providers] = await Promise.all([
    regionService.listCountries({ regionId: regionIds }),
    linkService.repo('regionPaymentProvider').findByRegionIds(regionIds),
    paymentService.listPaymentProviders(),
  ])

  return {
    status: 200,
    json: {
      regions: buildRegionViews(regions, countries, links, providers),
      count: matching.length,
      offset,
      limit,
    },
  }
}

export const PostInput = { body: AdminCreateRegion }
export const PostOutput = AdminRegionResponse
export const PostThrows = [...createRegionWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const region = await createRegionWorkflow.run(req.body)

  const [countries, links, providers] = await Promise.all([
    regionService.listCountries({ regionId: [region.id] }),
    linkService.repo('regionPaymentProvider').findByRegionIds([region.id]),
    paymentService.listPaymentProviders(),
  ])

  return { status: 201, json: { region: buildRegionView(region, countries, links, providers) } }
}
