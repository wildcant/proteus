import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import type * as categoryByIdRoutes from '../[id]/route.js'
import productCategoryDefinitions from '../definitions.js'
import type * as categoryRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: productCategoryDefinitions })
})

test.describe('Category tree', () => {
  test('a merchant builds, edits and prunes a two-level tree', async ({ expect, http }) => {
    const createCategory = async (body: object) => {
      const response = await api.post<typeof categoryRoutes.PostOutput>('/admin/product-categories', body)
      expect(response.status).toBe(201)
      return response.body.productCategory
    }

    const men = await createCategory(http.admin.createProductCategory({ name: 'Men', handle: undefined }))
    // Handle generated from the name; Active and Internal off until the merchant turns them on.
    expect(men).toMatchObject({ handle: 'men', parentId: null, rank: 0, isActive: false, isInternal: false })

    const women = await createCategory(http.admin.createProductCategory())
    const tops = await createCategory(http.admin.createProductCategory({ name: 'Tops', parentId: men.id }))
    const shoes = await createCategory(http.admin.createProductCategory({ parentId: men.id }))
    // Placed first among the existing siblings: the set is renumbered 0..n-1 around it.
    const sale = await createCategory(http.admin.createProductCategory({ parentId: men.id, rank: 0 }))
    // A rank past the end appends.
    const socks = await createCategory(http.admin.createProductCategory({ parentId: men.id, rank: 99 }))
    expect(socks.rank).toBe(3)

    const tree = await api.get<typeof categoryRoutes.GetOutput>('/admin/product-categories')
    expect(tree.status).toBe(200)
    expect(tree.body.productCategories.map((root) => root.id)).toEqual([men.id, women.id])
    const menChildren = tree.body.productCategories[0]?.children ?? []
    expect(menChildren.map((child) => [child.id, child.rank])).toEqual([
      [sale.id, 0],
      [tops.id, 1],
      [shoes.id, 2],
      [socks.id, 3],
    ])
    expect(tree.body.productCategories[1]?.children).toEqual([])

    const edited = await api.patch<typeof categoryByIdRoutes.PatchOutput>(`/admin/product-categories/${tops.id}`, {
      name: 'T-shirts',
      description: 'Short sleeves',
      isActive: true,
    })
    expect(edited.status).toBe(200)
    // The handle is never regenerated from a new name.
    expect(edited.body.productCategory).toMatchObject({ name: 'T-shirts', handle: 'tops', isActive: true })
    const retrieved = await api.get<typeof categoryByIdRoutes.GetOutput>(`/admin/product-categories/${tops.id}`)
    expect(retrieved.body.productCategory.description).toBe('Short sleeves')

    const refused = await api.delete<ApiErrorBody>(`/admin/product-categories/${men.id}`)
    expect(refused.status).toBe(400)
    expect(refused.body.type).toBe(ErrorTypes.NOT_ALLOWED)

    const deleted = await api.delete<typeof categoryByIdRoutes.DeleteOutput>(`/admin/product-categories/${tops.id}`)
    expect(deleted.body).toEqual({ id: tops.id, deleted: true })
    const gone = await api.get<ApiErrorBody>(`/admin/product-categories/${tops.id}`)
    expect(gone.status).toBe(404)

    const duplicate = await api.post<ApiErrorBody>(
      '/admin/product-categories',
      http.admin.createProductCategory({ handle: shoes.handle }),
    )
    expect(duplicate.body.type).toBe(ErrorTypes.DUPLICATE_ERROR)

    // The refused delete left the parent and its remaining children in place.
    const after = await api.get<typeof categoryRoutes.GetOutput>('/admin/product-categories')
    expect(after.body.productCategories[0]?.children.map((child) => child.id)).toEqual([sale.id, shoes.id, socks.id])
  })
})
