import { type AwilixContainer, asValue } from 'awilix'
import type { DbProvider } from '../core/db/ports.js'
import { ContainerRegistrationKeys } from '../core/utils/index.js'
import { CartPaymentCollectionRepository } from './repositories/cart-payment-collection.js'
import { CartProductRepository } from './repositories/cart-product.js'
import { ProductVariantInventoryItemRepository } from './repositories/product-variant-inventory-item.js'
import { ProductVariantPriceSetRepository } from './repositories/product-variant-price-set.js'
import { LinkService } from './services/link-service.js'

export function registerLinkService(sharedContainer: AwilixContainer): void {
  const dbProvider: DbProvider = sharedContainer.resolve(ContainerRegistrationKeys.DB_PROVIDER)
  const getDb = dbProvider.getDb.bind(dbProvider)

  const productVariantInventoryItem = new ProductVariantInventoryItemRepository({ getDb })
  const cartProduct = new CartProductRepository({ getDb })
  const cartPaymentCollection = new CartPaymentCollectionRepository({ getDb })
  const productVariantPriceSet = new ProductVariantPriceSetRepository({ getDb })

  const linkService = new LinkService({
    productVariantInventoryItem,
    cartProduct,
    cartPaymentCollection,
    productVariantPriceSet,
  })

  sharedContainer.register({
    [ContainerRegistrationKeys.LINK]: asValue(linkService),
  })
}
