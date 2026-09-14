import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import type * as variantRoutes from '../[id]/variants/route.js'
import productDefinitions from '../definitions.js'

type Services = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: productDefinitions })
})

/** A tracked variant created through the same route as the shopkeeper, at the shop's one location. */
const createTrackedVariant = async (service: Services) => {
  await service.create.stockLocation(api.container)
  const { product } = await service.create.product(api.container)
  const response = await api.post<typeof variantRoutes.PostOutput>(`/admin/products/${product.id}/variants`, {
    optionValues: {},
  })

  return { product, variant: response.body.variant }
}

test.describe('PUT /admin/products/:id/variants/:variantId/stock', () => {
  test('sets an absolute Stocked Quantity and the variant list reflects its Available Quantity', async ({
    expect,
    service,
  }) => {
    const { product, variant } = await createTrackedVariant(service)

    await api.put(`/admin/products/${product.id}/variants/${variant.id}/stock`, { stockedQuantity: 9 })
    const response = await api.put(`/admin/products/${product.id}/variants/${variant.id}/stock`, {
      stockedQuantity: 4,
    })
    const listed = await api.get<{ variants: Array<{ id: string; availableQuantity: number | null }> }>(
      `/admin/products/${product.id}/variants`,
    )
    const detailed = await api.get<{ variant: { stock: { availableQuantity: number } | null } }>(
      `/admin/products/${product.id}/variants/${variant.id}`,
    )

    expect(response.status).toBe(200)
    expect(listed.body.variants).toContainEqual(expect.objectContaining({ id: variant.id, availableQuantity: 4 }))
    expect(detailed.body.variant.stock?.availableQuantity).toBe(4)
  })

  test('refuses Stocked Quantity below what orders reserved and leaves the shelf count unchanged', async ({
    expect,
    service,
  }) => {
    const { product, variant } = await createTrackedVariant(service)
    await api.put(`/admin/products/${product.id}/variants/${variant.id}/stock`, { stockedQuantity: 5 })

    const [link] = await service.read
      .linkRepo(api.container, 'productVariantInventoryItem')
      .findByVariantIds([variant.id])
    if (!link) throw new Error('Expected the tracked variant to have an Inventory Item')
    const [level] = await service.read.inventoryLevels(api.container, { inventoryItemId: link.inventoryItemId })
    if (!level) throw new Error('Expected the Inventory Item to have an Inventory Level')
    await service.create.reservedStock(api.container, {
      inventoryItemId: link.inventoryItemId,
      locationId: level.locationId,
      quantity: 3,
      lineItemId: 'orderli_committed',
    })

    const response = await api.put<ApiErrorBody>(`/admin/products/${product.id}/variants/${variant.id}/stock`, {
      stockedQuantity: 2,
    })
    const listed = await api.get<{ variants: Array<{ id: string; availableQuantity: number | null }> }>(
      `/admin/products/${product.id}/variants`,
    )

    expect(response.status).toBe(400)
    expect(response.body.type).toBe('not_allowed')
    expect(response.body.message).toContain('3 unit(s) are reserved')
    expect(listed.body.variants).toContainEqual(expect.objectContaining({ id: variant.id, availableQuantity: 2 }))
  })

  test('shows no Available Quantity for an untracked variant and refuses a stock write', async ({
    expect,
    service,
  }) => {
    await service.create.stockLocation(api.container)
    const { product } = await service.create.product(api.container)
    const created = await api.post<typeof variantRoutes.PostOutput>(`/admin/products/${product.id}/variants`, {
      optionValues: {},
      manageInventory: false,
    })
    const variant = created.body.variant

    const listed = await api.get<{ variants: Array<{ id: string; availableQuantity: number | null }> }>(
      `/admin/products/${product.id}/variants`,
    )
    const response = await api.put<ApiErrorBody>(`/admin/products/${product.id}/variants/${variant.id}/stock`, {
      stockedQuantity: 7,
    })

    expect(listed.body.variants).toContainEqual(expect.objectContaining({ id: variant.id, availableQuantity: null }))
    expect(response.status).toBe(400)
    expect(response.body.type).toBe('not_allowed')
    expect(response.body.message).toContain('untracked variant')
  })
})
