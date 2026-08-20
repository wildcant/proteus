import type { Context } from '../../core/types/context.js'
import type {
  DismissLinksInput,
  DismissLinksResult,
  LinkColumnRegistry,
  WritableLinkRepoKey,
} from '../../core/types/link/service.js'
import type { CartPaymentCollectionRepository } from '../repositories/cart-payment-collection.js'
import type { CartProductRepository } from '../repositories/cart-product.js'
import type { OrderCartRepository } from '../repositories/order-cart.js'
import type { OrderFulfillmentRepository } from '../repositories/order-fulfillment.js'
import type { OrderPaymentCollectionRepository } from '../repositories/order-payment-collection.js'
import type { ProductVariantInventoryItemRepository } from '../repositories/product-variant-inventory-item.js'
import type { ProductVariantPriceSetRepository } from '../repositories/product-variant-price-set.js'

export type LinkRepositoryMap = {
  productVariantInventoryItem: ProductVariantInventoryItemRepository
  cartProduct: CartProductRepository
  cartPaymentCollection: CartPaymentCollectionRepository
  productVariantPriceSet: ProductVariantPriceSetRepository
  orderCart: OrderCartRepository
  orderPaymentCollection: OrderPaymentCollectionRepository
  orderFulfillment: OrderFulfillmentRepository
}

type WritableLinkRepositoryMap = {
  [K in WritableLinkRepoKey]: LinkRepositoryMap[K]
}

type InjectedDependencies = {
  [K in keyof LinkRepositoryMap]: LinkRepositoryMap[K]
}

export class LinkService {
  private repositories: LinkRepositoryMap

  private static readonly COLUMN_REGISTRY = {
    variantId: ['productVariantPriceSet', 'productVariantInventoryItem'],
    cartId: ['cartPaymentCollection', 'orderCart'],
    paymentCollectionId: ['cartPaymentCollection', 'orderPaymentCollection'],
    inventoryItemId: ['productVariantInventoryItem'],
    priceSetId: ['productVariantPriceSet'],
    orderId: ['orderCart', 'orderPaymentCollection', 'orderFulfillment'],
    fulfillmentId: ['orderFulfillment'],
  } as const satisfies LinkColumnRegistry

  constructor({
    productVariantInventoryItem,
    cartProduct,
    cartPaymentCollection,
    productVariantPriceSet,
    orderCart,
    orderPaymentCollection,
    orderFulfillment,
  }: InjectedDependencies) {
    this.repositories = {
      productVariantInventoryItem,
      cartProduct,
      cartPaymentCollection,
      productVariantPriceSet,
      orderCart,
      orderPaymentCollection,
      orderFulfillment,
    }
  }

  repo<K extends keyof LinkRepositoryMap>(name: K): LinkRepositoryMap[K] {
    return this.repositories[name]
  }

  async dismissLinks<T extends DismissLinksInput>(input: T, context?: Context): Promise<DismissLinksResult<T>> {
    const repoFilters = new Map<WritableLinkRepoKey, Record<string, string[]>>()

    for (const [column, values] of Object.entries(input)) {
      if (!values || values.length === 0) continue
      const repoNames = LinkService.COLUMN_REGISTRY[column as keyof LinkColumnRegistry]
      if (!repoNames) continue

      for (const repoName of repoNames) {
        const existing = repoFilters.get(repoName) ?? {}
        existing[column] = values
        repoFilters.set(repoName, existing)
      }
    }

    const result = {} as DismissLinksResult<T>

    await Promise.all(
      Array.from(repoFilters.entries()).map(async ([repoName, filters]) => {
        const repository = this.repositories[repoName] as WritableLinkRepositoryMap[typeof repoName]
        const records = await repository.find(filters, undefined, context)
        if (records.length === 0) return

        await repository.softDelete(
          records.map((record) => record.id),
          context,
        )
        ;(result as Record<string, unknown[]>)[repoName] = records
      }),
    )

    return result as DismissLinksResult<T>
  }
}
