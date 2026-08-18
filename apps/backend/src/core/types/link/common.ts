import type { BigNumber } from '../../db/bignum.js'
import type { Context } from '../context.js'

export type ProductVariantInventoryItemDTO = {
  id: string
  variantId: string
  inventoryItemId: string
  requiredQuantity: number
  createdAt: Date
  deletedAt: Date | null
}

export type VariantInventoryAvailabilityDTO = {
  variantId: string
  inventoryItemId: string
  requiredQuantity: number
  locationId: string
  stockedQuantity: number
  reservedQuantity: number
}

export type LineItemWithProductDTO = {
  lineItemId: string
  quantity: number
  unitPrice: BigNumber
  variantId: string | null
  productId: string | null
  variantTitle: string | null
  variantSku: string | null
  productTitle: string | null
  productHandle: string | null
  productStatus: string | null
}

export type VariantProductDTO = {
  variantId: string
  variantTitle: string
  variantSku: string | null
  productId: string
  productTitle: string
  productHandle: string
  productStatus: string
}

export type IProductVariantInventoryItemRepository = {
  find(filters?: unknown, config?: unknown, context?: Context): Promise<ProductVariantInventoryItemDTO[]>
  findById(id: string, config?: unknown, context?: Context): Promise<ProductVariantInventoryItemDTO | null>
  findByIdOrFail(id: string, config?: unknown, context?: Context): Promise<ProductVariantInventoryItemDTO>
  findAndCount(
    filters?: unknown,
    config?: unknown,
    context?: Context,
  ): Promise<[ProductVariantInventoryItemDTO[], number]>
  create(data: Partial<ProductVariantInventoryItemDTO>, context?: Context): Promise<ProductVariantInventoryItemDTO>
  createMany(
    data: Partial<ProductVariantInventoryItemDTO>[],
    context?: Context,
  ): Promise<ProductVariantInventoryItemDTO[]>
  update(
    ids: string[],
    data: Partial<ProductVariantInventoryItemDTO>,
    context?: Context,
  ): Promise<ProductVariantInventoryItemDTO[]>
  delete(ids: string[], context?: Context): Promise<void>
  softDelete(ids: string[], context?: Context): Promise<void>
  restore(ids: string[], context?: Context): Promise<void>
  findByVariantIds(variantIds: string[], context?: Context): Promise<ProductVariantInventoryItemDTO[]>
  getInventoryAvailability(variantIds: string[], context?: Context): Promise<VariantInventoryAvailabilityDTO[]>
}

export type ICartProductRepository = {
  findLineItemsWithProducts(cartId: string, context?: Context): Promise<LineItemWithProductDTO[]>
  findProductsByVariantIds(variantIds: string[], context?: Context): Promise<VariantProductDTO[]>
}

export type CartPaymentCollectionDTO = {
  id: string
  cartId: string
  paymentCollectionId: string
  createdAt: Date
  deletedAt: Date | null
}

export type ICartPaymentCollectionRepository = {
  findByCartId(cartId: string, context?: Context): Promise<CartPaymentCollectionDTO | null>
  findByPaymentCollectionId(paymentCollectionId: string, context?: Context): Promise<CartPaymentCollectionDTO | null>
  create(data: Partial<CartPaymentCollectionDTO>, context?: Context): Promise<CartPaymentCollectionDTO>
}

export type ProductVariantPriceSetDTO = {
  id: string
  variantId: string
  priceSetId: string
  createdAt: Date
  deletedAt: Date | null
}

export type IProductVariantPriceSetRepository = {
  findByVariantIds(variantIds: string[], context?: Context): Promise<ProductVariantPriceSetDTO[]>
  create(data: Partial<ProductVariantPriceSetDTO>, context?: Context): Promise<ProductVariantPriceSetDTO>
  softDelete(ids: string[], context?: Context): Promise<void>
}
