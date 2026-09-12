import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCountryResponse,
  AdminUpdateCountryLocale,
  DeleteResponse,
  RegionCountryParams,
} from '@proteus/http-schemas/admin'

export const PostInput = { params: RegionCountryParams, body: AdminUpdateCountryLocale }
export const PostOutput = AdminCountryResponse
export const PostThrows = [ErrorTypes.NOT_FOUND] as const

/**
 * Repoints a country's locale without moving it between regions.
 *
 * Editable rather than fixed at assignment, because a wrong locale is a market that formats its
 * money and dates in the wrong conventions and there is no other way to repair one. What it costs
 * is that storefront URLs built from the old tag stop resolving — the form says so, and redirecting
 * them is a separate piece of work.
 *
 * A country sold to by another region is a 404 here rather than a 403: under *this* region it is
 * not a resource at all, and answering otherwise would let one region's screen edit another's.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)

  const country = await regionService.retrieveCountry(req.params.code)
  if (country.regionId !== req.params.id) {
    throw new AppError({
      type: ErrorTypes.NOT_FOUND,
      message: `Country "${req.params.code}" is not assigned to region "${req.params.id}"`,
    })
  }

  const [updated] = await regionService.updateCountries([country.id], { localeCode: req.body.localeCode })

  return { status: 200, json: { country: updated ?? country } }
}

export const DeleteInput = { params: RegionCountryParams }
export const DeleteOutput = DeleteResponse
export const DeleteThrows = [ErrorTypes.NOT_FOUND] as const

/**
 * Closes a market: the country stops being sold to, and stops carrying a locale.
 *
 * Both columns are cleared, not only `regionId`. `country.locale_code` is set exactly when
 * `region_id` is — a country left holding a locale it is not sellable in reads as a half-open
 * market to everything that inspects it, the next assignment included.
 */
export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)

  const country = await regionService.retrieveCountry(req.params.code)
  if (country.regionId !== req.params.id) {
    throw new AppError({
      type: ErrorTypes.NOT_FOUND,
      message: `Country "${req.params.code}" is not assigned to region "${req.params.id}"`,
    })
  }

  await regionService.updateCountries([country.id], { regionId: null, localeCode: null })

  return { status: 200, json: { id: country.id, deleted: true } }
}
