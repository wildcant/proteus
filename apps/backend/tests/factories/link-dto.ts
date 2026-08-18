import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import { faker } from '@faker-js/faker'

export function generateProductVariantInventoryItemDTO(
  overrides?: Partial<ProductVariantInventoryItemDTO>,
): ProductVariantInventoryItemDTO {
  return {
    id: `pvitem_${faker.string.alphanumeric(32)}`,
    variantId: `variant_${faker.string.alphanumeric(32)}`,
    inventoryItemId: `iitem_${faker.string.alphanumeric(32)}`,
    requiredQuantity: 1,
    createdAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}
