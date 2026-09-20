import type { AppContainer } from '../../../src/core/types/container.js'
import type { CreatePriceSetDTO } from '../../../src/core/types/pricing/mutations.js'
import { ContainerRegistrationKeys } from '../../../src/core/utils/container.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import { generateCreatePriceSetDTO } from '../pricing-dto.js'

/**
 * Gives each variant a price set and the variant↔price-set link the store routes read.
 * Those routes drop variants with no calculated price, so a variant a test expects to
 * see in a response needs one.
 */
export async function priceVariants(
  container: AppContainer,
  variantIds: string[],
  overrides?: Partial<CreatePriceSetDTO>,
) {
  const pricingService = container.resolve(Modules.PRICING)
  const linkService = container.resolve(ContainerRegistrationKeys.LINK)

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

// ---- Reads ----

export async function listPrices(container: AppContainer, priceSetId: string) {
  const pricingService = container.resolve(Modules.PRICING)

  return pricingService.listPrices({ priceSetId })
}
