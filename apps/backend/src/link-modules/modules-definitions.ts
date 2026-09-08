// Re-export module tables referenced by link definitions.
// This is the ONE place cross-module table imports are allowed —
// consumers (repos, drizzle schema config) import from here, never from modules directly.
export { cartLineItemTable } from '../modules/cart/models/line-item.js'
export { fulfillmentTable } from '../modules/fulfillment/models/fulfillment.js'
export { inventoryItemTable } from '../modules/inventory/models/inventory-item.js'
export { inventoryLevelTable } from '../modules/inventory/models/inventory-level.js'
export { orderTable } from '../modules/order/models/order.js'
export { paymentCollectionTable } from '../modules/payment/models/payment-collection.js'
export { paymentProviderTable } from '../modules/payment/models/payment-provider.js'
export { priceSetTable } from '../modules/pricing/models/price-set.js'
export { productTable } from '../modules/product/models/product.js'
export { productVariantTable } from '../modules/product/models/product-variant.js'
export { regionTable } from '../modules/region/models/region.js'
