import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import type * as productByIdRoutes from '../../products/[id]/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import type * as categoryProductRoutes from '../[id]/products/route.js'
import productCategoryDefinitions from '../definitions.js'
import type * as categoryRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...productCategoryDefinitions, ...productDefinitions] })
})

test.describe('Category membership', () => {
  test('a merchant fills a Category from both sides, and deleting it empties it', async ({ expect, http, service }) => {
    const createCategory = async (body: object) => {
      const response = await api.post<typeof categoryRoutes.PostOutput>('/admin/product-categories', body)
      return response.body.productCategory
    }
    const men = await createCategory(http.admin.createProductCategory())
    const tops = await createCategory(http.admin.createProductCategory({ name: 'Tops', parentId: men.id }))
    const shoes = await createCategory(http.admin.createProductCategory({ name: 'Shoes', parentId: men.id }))

    const listIn = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/admin/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((product) => product.id).sort(), count: response.body.count }
    }

    // From the product: create puts it in its Categories and the response embeds them.
    const created = await api.post<typeof productRoutes.PostOutput>('/admin/products', {
      title: 'Linen Shirt',
      categoryIds: [tops.id],
    })
    expect(created.status).toBe(201)
    const shirt = created.body.product
    expect(shirt.categories.map((category) => category.id)).toEqual([tops.id])

    // An unknown Category is NOT_FOUND on both product routes, and the create leaves nothing behind.
    const unknownOnCreate = await api.post<ApiErrorBody>('/admin/products', {
      title: 'Ghost',
      categoryIds: ['pcat_missing'],
    })
    expect(unknownOnCreate.status).toBe(404)
    expect(unknownOnCreate.body.type).toBe(ErrorTypes.NOT_FOUND)
    const unknownOnUpdate = await api.patch<ApiErrorBody>(`/admin/products/${shirt.id}`, {
      categoryIds: ['pcat_missing'],
    })
    expect(unknownOnUpdate.status).toBe(404)

    // From the Category: add then remove. The shirt is already in and the jacket never was, so
    // both of those are no-ops.
    const { product: tee } = await service.create.product(api.container)
    const { product: jacket } = await service.create.product(api.container)
    const assigned = await api.post<typeof categoryProductRoutes.PostOutput>(
      `/admin/product-categories/${tops.id}/products`,
      { add: [tee.id, shirt.id], remove: [jacket.id] },
    )
    expect(assigned.status).toBe(200)
    expect(assigned.body.productCategory.id).toBe(tops.id)

    expect(await listIn(`categoryId=${tops.id}`)).toEqual({ ids: [shirt.id, tee.id].sort(), count: 2 })
    // Direct members only: nothing sits in Men itself.
    expect(await listIn(`categoryId=${men.id}`)).toEqual({ ids: [], count: 0 })
    // ANDed with the other filters, in the page and its count alike.
    expect(await listIn(`categoryId=${tops.id}&q=${encodeURIComponent('Linen Shirt')}`)).toEqual({
      ids: [shirt.id],
      count: 1,
    })

    // An update replaces the set: the shirt leaves Tops for Shoes.
    const moved = await api.patch<typeof productByIdRoutes.PatchOutput>(`/admin/products/${shirt.id}`, {
      categoryIds: [shoes.id],
    })
    expect(moved.body.product.categories.map((category) => category.id)).toEqual([shoes.id])
    expect(await listIn(`categoryId=${tops.id}`)).toEqual({ ids: [tee.id], count: 1 })

    // Removing from the Category side, then the repeated key matches either Category.
    await api.post(`/admin/product-categories/${tops.id}/products`, { add: [jacket.id], remove: [tee.id] })
    expect(await listIn(`categoryId=${tops.id}&categoryId=${shoes.id}`)).toEqual({
      ids: [shirt.id, jacket.id].sort(),
      count: 2,
    })

    // Soft-deleting a Category hides its memberships; the product stays.
    await api.delete(`/admin/product-categories/${shoes.id}`)
    const retrieved = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${shirt.id}`)
    expect(retrieved.status).toBe(200)
    expect(retrieved.body.product.categories).toEqual([])
    expect(await listIn(`categoryId=${shoes.id}`)).toEqual({ ids: [], count: 0 })
  })
})
