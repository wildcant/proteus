import { faker } from '@faker-js/faker'
import type { AdminCreateProductCollectionBody } from '@proteus/http-schemas/admin'

/**
 * Generate an `AdminCreateProductCollectionBody` — the request body for `POST /admin/collections`.
 *
 * The title carries a unique suffix because the handle is generated from it and must be unique among
 * live Collections; two generated bodies in one test would otherwise collide by chance.
 */
export function generateAdminCreateProductCollectionBody(
  overrides?: Partial<AdminCreateProductCollectionBody>,
): AdminCreateProductCollectionBody {
  return {
    title: `${faker.commerce.productAdjective()} ${faker.string.alphanumeric(6)}`,
    ...overrides,
  }
}
