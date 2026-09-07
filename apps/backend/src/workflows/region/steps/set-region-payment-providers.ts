import type { ILinkService } from '@core/types/link/service.js'
import { ContainerRegistrationKeys } from '@core/utils/index.js'
import type { WorkflowContext } from '@core/workflows/types.js'

type SetRegionPaymentProvidersInput = {
  regionId: string
  paymentProviderIds: string[]
}

type StepOutput = {
  /** Restored on compensation, so the region ends up offering exactly what it offered before. */
  previousProviderIds: string[]
}

/**
 * Makes the region's payment providers exactly the given set.
 *
 * Replace rather than append: the editor shows the whole set and the merchant submits the whole
 * set, so a provider absent from the payload is one they removed. Links already in place are left
 * alone — re-creating them would churn ids that nothing else depends on, and the unique index on
 * `(regionId, paymentProviderId)` would refuse the duplicate anyway.
 */
export async function setRegionPaymentProvidersStep(
  ctx: WorkflowContext,
  input: SetRegionPaymentProvidersInput,
): Promise<void> {
  await ctx.step<StepOutput>(
    'set-region-payment-providers',
    async ({ container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const existing = await linkService.repo('regionPaymentProvider').findByRegionIds([input.regionId])
      const previousProviderIds = existing.map((link) => link.paymentProviderId)

      const wanted = new Set(input.paymentProviderIds)
      const removed = existing.filter((link) => !wanted.has(link.paymentProviderId))
      const added = input.paymentProviderIds.filter((providerId) => !previousProviderIds.includes(providerId))

      if (removed.length > 0) {
        await linkService.repo('regionPaymentProvider').softDelete(removed.map((link) => link.id))
      }
      if (added.length > 0) {
        await linkService.createMany(
          added.map((paymentProviderId) => ({
            link: 'regionPaymentProvider' as const,
            data: { regionId: input.regionId, paymentProviderId },
          })),
        )
      }

      return { previousProviderIds }
    },
    async ({ previousProviderIds }, { container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      await linkService.dismissLinks({ regionId: [input.regionId] })
      if (previousProviderIds.length === 0) return
      await linkService.createMany(
        previousProviderIds.map((paymentProviderId) => ({
          link: 'regionPaymentProvider' as const,
          data: { regionId: input.regionId, paymentProviderId },
        })),
      )
    },
  )
}
