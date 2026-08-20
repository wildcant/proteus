export const Modules = {
  AUTH: 'auth',
  USER: 'user',
  CUSTOMER: 'customer',
  CART: 'cart',
  ORDER: 'order',
  PAYMENT: 'payment',
  PROMOTION: 'promotion',
  INVENTORY: 'inventory',
  PRICING: 'pricing',
  PRODUCT: 'product',
  FULFILLMENT: 'fulfillment',
  NOTIFICATION: 'notification',
} as const

export const Links = {
  PRODUCT_VARIANT_INVENTORY_ITEM: 'productVariantInventoryItem',
  CART_PRODUCT: 'cartProduct',
  CART_PAYMENT_COLLECTION: 'cartPaymentCollection',
  PRODUCT_VARIANT_PRICE_SET: 'productVariantPriceSet',
  ORDER_CART: 'orderCart',
  ORDER_PAYMENT_COLLECTION: 'orderPaymentCollection',
  ORDER_FULFILLMENT: 'orderFulfillment',
} as const
