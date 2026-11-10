import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import type * as productByIdRoutes from '../../products/[id]/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import type * as collectionProductRoutes from '../[id]/products/route.js'
import type * as collectionByIdRoutes from '../[id]/route.js'
import collectionDefinitions from '../definitions.js'
import type * as collectionRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...collectionDefinitions, ...productDefinitions] })
})

test.describe('Collections', () => {
  test('a merchant curates Collections from both sides; one product sits in two; deleting one empties it', async ({
    expect,
    http,
    service,
  }) => {
    const createCollection = async (body: object) => {
      const response = await api.post<typeof collectionRoutes.PostOutput>('/admin/collections', body)
      expect(response.status).toBe(201)
      return response.body.collection
    }
    const essentials = await createCollection(
      http.admin.createProductCollection({ title: 'Essentials', thumbnail: 'https://cdn.example.com/e.jpg' }),
    )
    expect(essentials.handle).toBe('essentials')
    expect(essentials.thumbnail).toBe('https://cdn.example.com/e.jpg')
    const active = await createCollection(http.admin.createProductCollection({ title: 'Active' }))

    // A taken handle is DUPLICATE_ERROR, with no auto-suffix.
    const duplicate = await api.post<ApiErrorBody>('/admin/collections', { title: 'Essentials' })
    expect(duplicate.status).toBe(422)
    expect(duplicate.body.type).toBe(ErrorTypes.DUPLICATE_ERROR)

    // Edit keeps the handle unless one is sent.
    const renamed = await api.patch<typeof collectionByIdRoutes.PatchOutput>(`/admin/collections/${active.id}`, {
      title: 'Active Wear',
    })
    expect(renamed.status).toBe(200)
    expect(renamed.body.collection).toMatchObject({ title: 'Active Wear', handle: 'active' })

    // The list searches title and handle.
    const searched = await api.get<typeof collectionRoutes.GetOutput>('/admin/collections?q=wear')
    expect(searched.body.collections.map((collection) => collection.id)).toEqual([active.id])
    expect(searched.body.count).toBe(1)

    const listIn = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/admin/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((product) => product.id).sort(), count: response.body.count }
    }

    // From the product: create puts the hoodie in Essentials, and the response embeds it.
    const created = await api.post<typeof productRoutes.PostOutput>('/admin/products', {
      title: 'Hoodie',
      collectionIds: [essentials.id],
    })
    expect(created.status).toBe(201)
    const hoodie = created.body.product
    expect(hoodie.collections.map((collection) => collection.id)).toEqual([essentials.id])

    // An unknown Collection is NOT_FOUND on both product routes.
    const unknownOnCreate = await api.post<ApiErrorBody>('/admin/products', {
      title: 'Ghost',
      collectionIds: ['pcol_missing'],
    })
    expect(unknownOnCreate.status).toBe(404)
    const unknownOnUpdate = await api.patch<ApiErrorBody>(`/admin/products/${hoodie.id}`, {
      collectionIds: ['pcol_missing'],
    })
    expect(unknownOnUpdate.status).toBe(404)

    // From the Collection: adding the hoodie to Active leaves it in Essentials too (ADR 0032).
    // Removing the never-added leggings is a no-op.
    const { product: shorts } = await service.create.product(api.container)
    const { product: leggings } = await service.create.product(api.container)
    const assigned = await api.post<typeof collectionProductRoutes.PostOutput>(
      `/admin/collections/${active.id}/products`,
      { add: [hoodie.id, shorts.id], remove: [leggings.id] },
    )
    expect(assigned.status).toBe(200)
    expect(assigned.body.collection.id).toBe(active.id)

    const inBoth = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${hoodie.id}`)
    expect(inBoth.body.product.collections.map((collection) => collection.id).sort()).toEqual(
      [essentials.id, active.id].sort(),
    )
    expect(await listIn(`collectionId=${active.id}`)).toEqual({ ids: [hoodie.id, shorts.id].sort(), count: 2 })
    expect(await listIn(`collectionId=${essentials.id}`)).toEqual({ ids: [hoodie.id], count: 1 })
    // ANDed with the other filters, in the page and its count alike.
    expect(await listIn(`collectionId=${active.id}&q=Hoodie`)).toEqual({ ids: [hoodie.id], count: 1 })

    // An update replaces the product's set: the shorts move from Active to Essentials.
    const moved = await api.patch<typeof productByIdRoutes.PatchOutput>(`/admin/products/${shorts.id}`, {
      collectionIds: [essentials.id],
    })
    expect(moved.body.product.collections.map((collection) => collection.id)).toEqual([essentials.id])
    expect(await listIn(`collectionId=${active.id}`)).toEqual({ ids: [hoodie.id], count: 1 })
    // A repeated key matches either Collection.
    expect(await listIn(`collectionId=${active.id}&collectionId=${essentials.id}`)).toEqual({
      ids: [hoodie.id, shorts.id].sort(),
      count: 2,
    })

    // Soft-deleting a Collection hides its memberships; the products stay, still in the other one.
    const deleted = await api.delete(`/admin/collections/${essentials.id}`)
    expect(deleted.status).toBe(200)
    const missing = await api.get<ApiErrorBody>(`/admin/collections/${essentials.id}`)
    expect(missing.status).toBe(404)
    const afterDelete = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${hoodie.id}`)
    expect(afterDelete.status).toBe(200)
    expect(afterDelete.body.product.collections.map((collection) => collection.id)).toEqual([active.id])
    expect(await listIn(`collectionId=${essentials.id}`)).toEqual({ ids: [], count: 0 })
  })
})
