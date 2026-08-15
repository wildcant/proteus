import type { CartPaymentCollectionRepository } from '../repositories/cart-payment-collection.js'
import type { CartProductRepository } from '../repositories/cart-product.js'
import type { ProductVariantInventoryItemRepository } from '../repositories/product-variant-inventory-item.js'
import type { ProductVariantPriceSetRepository } from '../repositories/product-variant-price-set.js'

export type LinkRepositoryMap = {
  productVariantInventoryItem: ProductVariantInventoryItemRepository
  cartProduct: CartProductRepository
  cartPaymentCollection: CartPaymentCollectionRepository
  productVariantPriceSet: ProductVariantPriceSetRepository
}

type InjectedDependencies = {
  [K in keyof LinkRepositoryMap]: LinkRepositoryMap[K]
}

export class LinkService {
  private repositories: LinkRepositoryMap

  constructor({
    productVariantInventoryItem,
    cartProduct,
    cartPaymentCollection,
    productVariantPriceSet,
  }: InjectedDependencies) {
    this.repositories = {
      productVariantInventoryItem,
      cartProduct,
      cartPaymentCollection,
      productVariantPriceSet,
    }
  }

  repo<K extends keyof LinkRepositoryMap>(name: K): LinkRepositoryMap[K] {
    return this.repositories[name]
  }
}
