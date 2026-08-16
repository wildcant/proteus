/**
 * Combined schema — single source of truth for all tables and relations.
 * Passed to drizzle via DRIZZLE_OPTIONS so getDb() returns a schema-aware instance.
 */
// Re-export module tables referenced by link definitions.
// This is the ONE place cross-module table imports are allowed —
// consumers (repos, drizzle schema config) import from here, never from modules directly.

// Links
export { cartPaymentCollectionTable } from './link-modules/definitions/cart-payment-collection.js'
export type { productVariantInventoryItemTable } from './link-modules/definitions/product-variant-inventory-item.js'
export {
  productVariantPriceSetRelations,
  productVariantPriceSetTable,
} from './link-modules/definitions/product-variant-price-set.js'
export { cartLineItemProductRelations } from './link-modules/definitions/readonly/index.js'

// Modules
export { cartLineItemTable } from './modules/cart/models/line-item.js'
export { inventoryItemTable } from './modules/inventory/models/inventory-item.js'
export { inventoryLevelTable } from './modules/inventory/models/inventory-level.js'
export { paymentCollectionTable } from './modules/payment/models/payment-collection.js'
export { priceTable } from './modules/pricing/models/price.js'
export { priceSetTable } from './modules/pricing/models/price-set.js'
export { priceRelations, priceSetRelations } from './modules/pricing/models/relations.js'
export { productTable } from './modules/product/models/product.js'
export { productVariantTable } from './modules/product/models/product-variant.js'
