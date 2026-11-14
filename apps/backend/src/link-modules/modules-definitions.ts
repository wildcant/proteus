// Re-export module tables referenced by link definitions.
// This is the ONE place cross-module table imports are allowed —
// consumers (repos, drizzle schema config) import from here, never from modules directly.
export { roleTable } from '../modules/access-control/models/role.js'
export { cartLineItemTable } from '../modules/cart/models/line-item.js'
export { inventoryItemTable } from '../modules/inventory/models/inventory-item.js'
export { inventoryLevelTable } from '../modules/inventory/models/inventory-level.js'
export { paymentProviderTable } from '../modules/payment/models/payment-provider.js'
export { priceTable } from '../modules/pricing/models/price.js'
export { priceSetTable } from '../modules/pricing/models/price-set.js'
export { productTable } from '../modules/product/models/product.js'
export { productOptionTable } from '../modules/product/models/product-option.js'
export { productOptionValueTable } from '../modules/product/models/product-option-value.js'
export { productProductOptionTable } from '../modules/product/models/product-product-option.js'
export { productProductOptionValueTable } from '../modules/product/models/product-product-option-value.js'
export { productVariantTable } from '../modules/product/models/product-variant.js'
export { productVariantOptionTable } from '../modules/product/models/product-variant-option.js'
// Not a table: the product list's WHERE, so a cross-module listing narrows exactly as the list does.
export { productWhere } from '../modules/product/utils/product-where.js'
export { regionTable } from '../modules/region/models/region.js'
export { inviteTable } from '../modules/user/models/invite.js'
