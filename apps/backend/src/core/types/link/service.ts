import type { Context } from '../context.js'
import type {
  CartPaymentCollectionDTO,
  ICartPaymentCollectionRepository,
  ICartProductRepository,
  IOrderCartRepository,
  IOrderFulfillmentRepository,
  IOrderPaymentCollectionRepository,
  IProductVariantInventoryItemRepository,
  IProductVariantPriceSetRepository,
  IRegionPaymentProviderRepository,
  OrderCartDTO,
  OrderFulfillmentDTO,
  OrderPaymentCollectionDTO,
  ProductVariantInventoryItemDTO,
  ProductVariantPriceSetDTO,
  RegionPaymentProviderDTO,
} from './common.js'

export type ILinkRepositoryMap = {
  cartProduct: ICartProductRepository

  // Writable.
  productVariantInventoryItem: IProductVariantInventoryItemRepository
  cartPaymentCollection: ICartPaymentCollectionRepository
  productVariantPriceSet: IProductVariantPriceSetRepository
  orderCart: IOrderCartRepository
  orderPaymentCollection: IOrderPaymentCollectionRepository
  orderFulfillment: IOrderFulfillmentRepository
  regionPaymentProvider: IRegionPaymentProviderRepository
}

export type LinkColumnRegistry = {
  variantId: readonly ['productVariantPriceSet', 'productVariantInventoryItem']
  cartId: readonly ['cartPaymentCollection', 'orderCart']
  paymentCollectionId: readonly ['cartPaymentCollection', 'orderPaymentCollection']
  inventoryItemId: readonly ['productVariantInventoryItem']
  priceSetId: readonly ['productVariantPriceSet']
  orderId: readonly ['orderCart', 'orderPaymentCollection', 'orderFulfillment']
  fulfillmentId: readonly ['orderFulfillment']
  regionId: readonly ['regionPaymentProvider']
  paymentProviderId: readonly ['regionPaymentProvider']
}

export type WritableLinkRepoKey = LinkColumnRegistry[keyof LinkColumnRegistry][number]

export type DismissLinksInput = { [K in keyof LinkColumnRegistry]?: string[] }

export type WritableLinkDTOMap = {
  productVariantPriceSet: ProductVariantPriceSetDTO
  productVariantInventoryItem: ProductVariantInventoryItemDTO
  cartPaymentCollection: CartPaymentCollectionDTO
  orderCart: OrderCartDTO
  orderPaymentCollection: OrderPaymentCollectionDTO
  orderFulfillment: OrderFulfillmentDTO
  regionPaymentProvider: RegionPaymentProviderDTO
}

export type DismissLinksResult<T extends DismissLinksInput = DismissLinksInput> = {
  [R in LinkColumnRegistry[keyof T & keyof LinkColumnRegistry][number]]?: WritableLinkDTOMap[R][]
}

/** One link to create, keyed by the repository that owns it. `data` is narrowed to that
 *  repository's payload, so the pair cannot be mismatched. */
export type CreateLinksInput = {
  [K in WritableLinkRepoKey]: { link: K; data: Partial<WritableLinkDTOMap[K]> }
}[WritableLinkRepoKey]

export type ILinkService = {
  repo<K extends keyof ILinkRepositoryMap>(name: K): ILinkRepositoryMap[K]
  /** Creates several links atomically, in the given order. Link tables share one database, so
   *  callers get all-or-nothing without handling a transaction themselves: if a later link
   *  violates a constraint, the earlier ones roll back with it rather than being left behind
   *  for a compensation that never runs. Order matters — put the most constrained link first
   *  so it fails before the rest do any work. */
  createMany(links: CreateLinksInput[], context?: Context): Promise<void>
  dismissLinks<T extends DismissLinksInput>(input: T, context?: Context): Promise<DismissLinksResult<T>>
}
