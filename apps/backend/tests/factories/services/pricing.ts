import type { AwilixContainer } from 'awilix'
import type { ILinkService } from '../../../src/core/types/link/service.js'
import type { CreatePriceSetDTO } from '../../../src/core/types/pricing/mutations.js'
import type { IPricingModuleService } from '../../../src/core/types/pricing/service.js'
import { ContainerRegistrationKeys, Modules } from '../../../src/core/utils/index.js'
import { generateCreatePriceSetDTO } from '../pricing-dto.js'

/**
 * Gives each variant a price set and the variant↔price-set link the store routes read.
 * Those routes drop variants with no calculated price, so a variant a test expects to
 * see in a response needs one.
 */
export async function priceVariants(
  container: AwilixContainer,
  variantIds: string[],
  overrides?: Partial<CreatePriceSetDTO>,
) {
  const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
  const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const priceSets = await pricingService.createPriceSets(variantIds.map(() => generateCreatePriceSetDTO(overrides)))

  await Promise.all(
    variantIds.map((variantId, index) => {
      const priceSet = priceSets[index]
      if (!priceSet) throw new Error(`Missing price set for variant "${variantId}"`)
      return linkService.repo('productVariantPriceSet').create({ variantId, priceSetId: priceSet.id })
    }),
  )

  return priceSets
}
