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
  OrderCartDTO,
  OrderFulfillmentDTO,
  OrderPaymentCollectionDTO,
  ProductVariantInventoryItemDTO,
  ProductVariantPriceSetDTO,
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
}

export type LinkColumnRegistry = {
  variantId: readonly ['productVariantPriceSet', 'productVariantInventoryItem']
  cartId: readonly ['cartPaymentCollection', 'orderCart']
  paymentCollectionId: readonly ['cartPaymentCollection', 'orderPaymentCollection']
  inventoryItemId: readonly ['productVariantInventoryItem']
  priceSetId: readonly ['productVariantPriceSet']
  orderId: readonly ['orderCart', 'orderPaymentCollection', 'orderFulfillment']
  fulfillmentId: readonly ['orderFulfillment']
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
}

export type DismissLinksResult<T extends DismissLinksInput = DismissLinksInput> = {
  [R in LinkColumnRegistry[keyof T & keyof LinkColumnRegistry][number]]?: WritableLinkDTOMap[R][]
}

export type ILinkService = {
  repo<K extends keyof ILinkRepositoryMap>(name: K): ILinkRepositoryMap[K]
  dismissLinks<T extends DismissLinksInput>(input: T, context?: Context): Promise<DismissLinksResult<T>>
}
