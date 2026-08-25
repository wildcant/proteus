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
  type CreateProductVariantPriceSet,
  productVariantPriceSetRelations,
  productVariantPriceSetTable,
} from './link-modules/definitions/product-variant-price-set.js'
export { cartLineItemProductRelations } from './link-modules/definitions/readonly/index.js'

// Modules
export * from './modules/auth/models/index.js'
export * from './modules/cart/models/index.js'
export * from './modules/customer/models/index.js'
export * from './modules/fulfillment/models/index.js'
export * from './modules/inventory/models/index.js'
export * from './modules/notification/models/index.js'
export * from './modules/payment/models/index.js'
export * from './modules/pricing/models/index.js'
export * from './modules/product/models/index.js'
export * from './modules/user/models/index.js'
