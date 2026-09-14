import { ErrorTypes } from '@core/errors/app-error.js'
import type { CountryDTO } from '@core/types/region/common.js'
import type { SetCountryMarketDTO } from '@core/types/region/mutations.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'

/** A step in its own file still owns its failure contract; the workflow calling it spreads this. */
export const assignCountriesToRegionThrows = [ErrorTypes.CONFLICT] as const

type AssignCountriesToRegionInput = {
  regionId: string
  /** Each country's ISO 3166-1 alpha-2 code, lowercased, and the locale it is sold in. */
  countries: { id: string; localeCode: string }[]
}

type StepOutput = {
  countries: CountryDTO[]
  /** Restored on compensation, so every country ends up in the market it was in before. */
  before: SetCountryMarketDTO[]
}

/**
 * Makes a list of countries sellable in a region, each in the locale that region's storefront reads
 * it in.
 *
 * The whole list in one step rather than a step per country: the writes all land in the region
 * module, so `setCountryMarkets` runs them in one transaction and a batch cannot half-apply. Every
 * country is read and checked before any of them is written, so a refusal leaves the table exactly
 * as it was without needing the rollback at all.
 *
 * `retrieveCountry` is the existence check. The ISO 3166-1 table ships whole and is never authored,
 * so a code naming no row is a client sending a code that does not exist, not a country to create.
 *
 * A country another region already sells to is refused rather than moved. Reassigning it silently
 * would close a market the merchant never opened this screen to touch, and the picker does not
 * offer it in the first place — so a request carrying one is a mistake worth naming.
 */
export async function assignCountriesToRegionStep(
  ctx: WorkflowContext,
  input: AssignCountriesToRegionInput,
): Promise<CountryDTO[]> {
  const { countries } = await ctx.step<StepOutput>(
    'assign-countries-to-region',
    async ({ container }) => {
      const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
      const existing = await Promise.all(input.countries.map((country) => regionService.retrieveCountry(country.id)))

      const taken = existing.find((country) => country.regionId !== null && country.regionId !== input.regionId)
      if (taken) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: `"${taken.displayName}" is already sold to by region "${taken.regionId}". Remove it from that region first.`,
        })
      }

      const countries = await regionService.setCountryMarkets(
        input.countries.map((country) => ({
          iso2: country.id,
          regionId: input.regionId,
          localeCode: country.localeCode,
        })),
      )

      return {
        countries,
        before: existing.map((country) => ({
          iso2: country.id,
          regionId: country.regionId,
          localeCode: country.localeCode,
        })),
      }
    },
    async ({ before }, { container }) => {
      const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
      await regionService.setCountryMarkets(before)
    },
  )

  return countries
}
