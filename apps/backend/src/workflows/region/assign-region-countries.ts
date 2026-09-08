import type { CountryDTO } from '@core/types/region/common.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import { assignCountryToRegionStep, assignCountryToRegionThrows } from './steps/assign-country-to-region.js'

type AssignRegionCountriesInput = {
  regionId: string
  /** Each country's ISO 3166-1 alpha-2 code, lowercased, and the locale it is sold in. */
  countries: { id: string; localeCode: string }[]
}

/**
 * Opens a market: points countries at the region that sells to them, each with the locale its
 * storefront runs in.
 *
 * A workflow rather than a loop in the handler because assigning several countries is several
 * writes, and half of them landing is a merchant looking at a table that shows some of what they
 * asked for with no way to tell which part failed. Every country is its own compensating step, so
 * the request either opens all of them or none.
 *
 * The region is retrieved first, and only so that an unknown id is a 404 before any country moves.
 */
export const assignRegionCountriesWorkflow = createWorkflow<AssignRegionCountriesInput, CountryDTO[]>(
  { name: 'assign-region-countries', throws: [...assignCountryToRegionThrows] },
  async (ctx, input) => {
    await ctx.step('assert-region-exists', async ({ container }) => {
      const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
      await regionService.retrieveRegion(input.regionId)
    })

    const assigned: CountryDTO[] = []
    for (const country of input.countries) {
      assigned.push(
        await assignCountryToRegionStep(ctx, {
          regionId: input.regionId,
          code: country.id,
          localeCode: country.localeCode,
        }),
      )
    }

    return assigned
  },
)
