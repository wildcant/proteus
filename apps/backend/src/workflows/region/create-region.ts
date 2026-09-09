import type { RegionDTO } from '@core/types/region/common.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import { assertStoreSellsCurrencyStep, assertStoreSellsCurrencyThrows } from './steps/assert-store-sells-currency.js'
import { setRegionPaymentProvidersStep } from './steps/set-region-payment-providers.js'

type CreateRegionInput = {
  name: string
  currencyCode: string
  paymentProviderIds?: string[]
}

/**
 * Creates a region and the payment providers it offers, as one act.
 *
 * The providers live in a link table the region module cannot write, so this is two modules'
 * writes: without the compensation, a provider id that names nothing would leave behind a region
 * the merchant never finished creating and cannot delete — there is no delete route, by design.
 */
export const createRegionWorkflow = createWorkflow<CreateRegionInput, RegionDTO>(
  { name: 'create-region', throws: [...assertStoreSellsCurrencyThrows] },
  async (ctx, input) => {
    await assertStoreSellsCurrencyStep(ctx, input.currencyCode)

    const region = await ctx.step(
      'create-region',
      async ({ container }) => {
        const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
        return regionService.createRegion({ name: input.name, currencyCode: input.currencyCode })
      },
      async (created, { container }) => {
        const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
        await regionService.softDeleteRegions([created.id])
      },
    )

    if (input.paymentProviderIds?.length) {
      await setRegionPaymentProvidersStep(ctx, {
        regionId: region.id,
        paymentProviderIds: input.paymentProviderIds,
      })
    }

    return region
  },
)
