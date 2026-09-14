import type { CountryDTO } from '@core/types/region/common.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'
import { assignCountriesToRegionStep, assignCountriesToRegionThrows } from './steps/assign-countries-to-region.js'

type AssignRegionCountriesInput = {
  regionId: string
  /** Each country's ISO 3166-1 alpha-2 code, lowercased, and the locale it is sold in. */
  countries: { id: string; localeCode: string }[]
}

/**
 * Opens a market: points countries at the region that sells to them, each with the locale its
 * storefront runs in.
 *
 * The assignment is one step over the whole list, and the writes inside it are one transaction, so
 * the request either opens every market it names or none of them — half of them landing is a
 * merchant looking at a table that shows some of what they asked for with no way to tell which part
 * failed.
 *
 * The region is retrieved first, and only so that an unknown id is a 404 before any country moves.
 */
export const assignRegionCountriesWorkflow = createWorkflow<AssignRegionCountriesInput, CountryDTO[]>(
  { name: 'assign-region-countries', throws: [...assignCountriesToRegionThrows] },
  async (ctx, input) => {
    await ctx.step('assert-region-exists', async ({ container }) => {
      const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
      await regionService.retrieveRegion(input.regionId)
    })

    return assignCountriesToRegionStep(ctx, { regionId: input.regionId, countries: input.countries })
  },
)
