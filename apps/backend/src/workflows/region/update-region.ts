import type { RegionDTO } from '@core/types/region/common.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import { assertStoreSellsCurrencyStep, assertStoreSellsCurrencyThrows } from './steps/assert-store-sells-currency.js'
import { setRegionPaymentProvidersStep } from './steps/set-region-payment-providers.js'

type UpdateRegionInput = {
  regionId: string
  name?: string
  currencyCode?: string
  /** Omitted leaves the region's providers alone; given, it replaces them. */
  paymentProviderIds?: string[]
}

/**
 * Edits a region and, when the payload names them, the payment providers it offers.
 *
 * Retrieving first is what makes an unknown id a 404 rather than a silent no-op, and it is also
 * what the compensation puts back — the region and its providers move together, so a failure
 * halfway cannot leave a region settling in one currency while offering another's gateways.
 */
export const updateRegionWorkflow = createWorkflow<UpdateRegionInput, RegionDTO>(
  { name: 'update-region', throws: [...assertStoreSellsCurrencyThrows] },
  async (ctx, input) => {
    await assertStoreSellsCurrencyStep(ctx, input.currencyCode)

    const region = await ctx.step(
      'update-region',
      async ({ container }) => {
        const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
        const before = await regionService.retrieveRegion(input.regionId)

        const changes = {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.currencyCode !== undefined && { currencyCode: input.currencyCode }),
        }
        // A payload that only replaces the providers changes no column on the region itself, and
        // an update with nothing to set is an error rather than a no-op.
        if (Object.keys(changes).length === 0) return { before, updated: before }

        const [updated] = await regionService.updateRegions([input.regionId], changes)
        return { before, updated: updated ?? before }
      },
      async ({ before }, { container }) => {
        const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
        await regionService.updateRegions([before.id], { name: before.name, currencyCode: before.currencyCode })
      },
    )

    if (input.paymentProviderIds) {
      await setRegionPaymentProvidersStep(ctx, {
        regionId: input.regionId,
        paymentProviderIds: input.paymentProviderIds,
      })
    }

    return region.updated
  },
)
