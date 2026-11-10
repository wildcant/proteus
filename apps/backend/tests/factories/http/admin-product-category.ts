import { faker } from '@faker-js/faker'
import type { AdminCreateProductCategoryBody } from '@proteus/http-schemas/admin'

/**
 * Generate an `AdminCreateProductCategoryBody` — the request body for
 * `POST /admin/product-categories`.
 *
 * The name carries a unique suffix because the handle is generated from it and must be unique among
 * live Categories; two generated bodies in one test would otherwise collide by chance.
 */
export function generateAdminCreateProductCategoryBody(
  overrides?: Partial<AdminCreateProductCategoryBody>,
): AdminCreateProductCategoryBody {
  return {
    name: `${faker.commerce.department()} ${faker.string.alphanumeric(6)}`,
    ...overrides,
  }
}
