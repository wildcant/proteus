import type { Context } from '../../core/types/context.js'
import type {
  CreateLinksInput,
  DismissLinksInput,
  DismissLinksResult,
  LinkColumnRegistry,
  WritableLinkRepoKey,
} from '../../core/types/link/service.js'
import type { WithTransaction } from '../../core/utils/with-transaction.js'
import type { CartPaymentCollectionRepository } from '../repositories/cart-payment-collection.js'
import type { CartProductRepository } from '../repositories/cart-product.js'
import type { OrderCartRepository } from '../repositories/order-cart.js'
import type { OrderFulfillmentRepository } from '../repositories/order-fulfillment.js'
import type { OrderPaymentCollectionRepository } from '../repositories/order-payment-collection.js'
import type { ProductVariantInventoryItemRepository } from '../repositories/product-variant-inventory-item.js'
import type { ProductVariantPriceSetRepository } from '../repositories/product-variant-price-set.js'
import type { RegionPaymentProviderRepository } from '../repositories/region-payment-provider.js'

export type LinkRepositoryMap = {
  productVariantInventoryItem: ProductVariantInventoryItemRepository
  cartProduct: CartProductRepository
  cartPaymentCollection: CartPaymentCollectionRepository
  productVariantPriceSet: ProductVariantPriceSetRepository
  orderCart: OrderCartRepository
  orderPaymentCollection: OrderPaymentCollectionRepository
  orderFulfillment: OrderFulfillmentRepository
  regionPaymentProvider: RegionPaymentProviderRepository
}

type WritableLinkRepositoryMap = {
  [K in WritableLinkRepoKey]: LinkRepositoryMap[K]
}

type LinkCreate = (data: object, context?: Context) => Promise<unknown>

type InjectedDependencies = {
  [K in keyof LinkRepositoryMap]: LinkRepositoryMap[K]
} & { withTransaction: WithTransaction }

export class LinkService {
  private repositories: LinkRepositoryMap
  private readonly withTransaction: WithTransaction

  private static readonly COLUMN_REGISTRY = {
    variantId: ['productVariantPriceSet', 'productVariantInventoryItem'],
    cartId: ['cartPaymentCollection', 'orderCart'],
    paymentCollectionId: ['cartPaymentCollection', 'orderPaymentCollection'],
    inventoryItemId: ['productVariantInventoryItem'],
    priceSetId: ['productVariantPriceSet'],
    orderId: ['orderCart', 'orderPaymentCollection', 'orderFulfillment'],
    fulfillmentId: ['orderFulfillment'],
    regionId: ['regionPaymentProvider'],
    paymentProviderId: ['regionPaymentProvider'],
  } as const satisfies LinkColumnRegistry

  constructor({
    productVariantInventoryItem,
    cartProduct,
    cartPaymentCollection,
    productVariantPriceSet,
    orderCart,
    orderPaymentCollection,
    orderFulfillment,
    regionPaymentProvider,
    withTransaction,
  }: InjectedDependencies) {
    this.withTransaction = withTransaction
    this.repositories = {
      productVariantInventoryItem,
      cartProduct,
      cartPaymentCollection,
      productVariantPriceSet,
      orderCart,
      orderPaymentCollection,
      orderFulfillment,
      regionPaymentProvider,
    }
  }

  repo<K extends keyof LinkRepositoryMap>(name: K): LinkRepositoryMap[K] {
    return this.repositories[name]
  }

  async createMany(links: CreateLinksInput[], context?: Context): Promise<void> {
    if (links.length === 0) return

    await this.withTransaction(context, async (transactionContext) => {
      for (const { link, data } of links) {
        // Sequential on purpose: these share one connection, and an early constraint
        // violation must abort the rest rather than race them.
        // TypeScript cannot correlate `link` with `data` across the union, so dispatch is
        // erased here. The public signature keeps the pair checked at every call site.
        const repository = this.repositories[link] as { create: LinkCreate }
        await repository.create(data, transactionContext)
      }
    })
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
