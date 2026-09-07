import { ErrorTypes } from '@core/errors/app-error.js'
import type { CountryDTO } from '@core/types/region/common.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/index.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'

/** A step in its own file still owns its failure contract; the workflow calling it spreads this. */
export const assignCountryToRegionThrows = [ErrorTypes.CONFLICT] as const

type AssignCountryToRegionInput = {
  regionId: string
  /** ISO 3166-1 alpha-2, lowercased. */
  code: string
  localeCode: string
}

type StepOutput = {
  country: CountryDTO
  /** Restored on compensation, so a country ends up in the market it was in before. */
  before: { regionId: string | null; localeCode: string | null }
}

/**
 * Makes one country sellable in a region, in the locale that region's storefront reads it in.
 *
 * One country per step rather than one step for the whole batch, because the compensation is what
 * keeps a half-applied assignment from surviving: only steps that *completed* are unwound, so a
 * batch step that failed on its third country would leave the first two assigned with nothing
 * recorded to put them back.
 *
 * `retrieveCountry` is the existence check. The ISO 3166-1 table ships whole and is never authored,
 * so a code naming no row is a client sending a code that does not exist, not a country to create.
 *
 * A country another region already sells to is refused rather than moved. Reassigning it silently
 * would close a market the merchant never opened this screen to touch, and the picker does not
 * offer it in the first place — so a request carrying one is a mistake worth naming.
 */
export async function assignCountryToRegionStep(
  ctx: WorkflowContext,
  input: AssignCountryToRegionInput,
): Promise<CountryDTO> {
  const { country } = await ctx.step<StepOutput>(
    'assign-country-to-region',
    async ({ container }) => {
      const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
      const existing = await regionService.retrieveCountry(input.code)

      if (existing.regionId !== null && existing.regionId !== input.regionId) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: `"${existing.displayName}" is already sold to by region "${existing.regionId}". Remove it from that region first.`,
        })
      }

      const [updated] = await regionService.updateCountries([input.code], {
        regionId: input.regionId,
        localeCode: input.localeCode,
      })

      return {
        country: updated ?? existing,
        before: { regionId: existing.regionId, localeCode: existing.localeCode },
      }
    },
    async ({ before }, { container }) => {
      const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
      await regionService.updateCountries([input.code], before)
    },
  )

  return country
}
