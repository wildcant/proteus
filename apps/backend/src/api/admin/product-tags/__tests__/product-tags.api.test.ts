import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import type * as productByIdRoutes from '../../products/[id]/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import type * as productTagByIdRoutes from '../[id]/route.js'
import productTagDefinitions from '../definitions.js'
import type * as productTagRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...productTagDefinitions, ...productDefinitions] })
})

test.describe('Tags', () => {
  test('a merchant names, renames and deletes Tags, tags products, and the product list filters by them', async ({
    expect,
    service,
  }) => {
    const createTag = async (value: string) => {
      const response = await api.post<typeof productTagRoutes.PostOutput>('/admin/product-tags', { value })
      expect(response.status).toBe(201)
      return response.body.tag
    }
    const cotton = await createTag('cotton')
    const leather = await createTag('leather')

    // Uniqueness is exact: a taken value is DUPLICATE_ERROR, another casing is a new Tag.
    const duplicate = await api.post<ApiErrorBody>('/admin/product-tags', { value: 'cotton' })
    expect(duplicate.status).toBe(422)
    expect(duplicate.body.type).toBe(ErrorTypes.DUPLICATE_ERROR)
    const otherCasing = await createTag('Cotton')

    const renamed = await api.patch<typeof productTagByIdRoutes.PatchOutput>(`/admin/product-tags/${leather.id}`, {
      value: 'vegan-leather',
    })
    expect(renamed.status).toBe(200)
    expect(renamed.body.tag.value).toBe('vegan-leather')
    const fetched = await api.get<typeof productTagByIdRoutes.GetOutput>(`/admin/product-tags/${leather.id}`)
    expect(fetched.body.tag.value).toBe('vegan-leather')
    const takenOnRename = await api.patch<ApiErrorBody>(`/admin/product-tags/${leather.id}`, { value: 'cotton' })
    expect(takenOnRename.body.type).toBe(ErrorTypes.DUPLICATE_ERROR)

    const searched = await api.get<typeof productTagRoutes.GetOutput>('/admin/product-tags?q=vegan')
    expect(searched.body.tags.map((tag) => tag.id)).toEqual([leather.id])
    expect(searched.body.count).toBe(1)

    // From the product: create sets the Tags, and the response embeds them by value.
    const created = await api.post<typeof productRoutes.PostOutput>('/admin/products', {
      title: 'Crewneck',
      tagIds: [leather.id, cotton.id],
    })
    expect(created.status).toBe(201)
    const crewneck = created.body.product
    expect(crewneck.tags.map((tag) => tag.value)).toEqual(['cotton', 'vegan-leather'])

    // An unknown Tag is NOT_FOUND on both product routes.
    const unknownOnCreate = await api.post<ApiErrorBody>('/admin/products', {
      title: 'Ghost',
      tagIds: ['ptag_missing'],
    })
    expect(unknownOnCreate.status).toBe(404)
    const unknownOnUpdate = await api.patch<ApiErrorBody>(`/admin/products/${crewneck.id}`, {
      tagIds: ['ptag_missing'],
    })
    expect(unknownOnUpdate.status).toBe(404)

    const { product: boot } = await service.create.product(api.container, { tagIds: [leather.id] })
    const { product: untagged } = await service.create.product(api.container)

    const listOf = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/admin/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((product) => product.id).sort(), count: response.body.count }
    }
    expect(await listOf(`tagId=${cotton.id}`)).toEqual({ ids: [crewneck.id], count: 1 })
    // A repeated key matches any of the Tags; ANDed with the other filters in the page and its count.
    expect(await listOf(`tagId=${cotton.id}&tagId=${leather.id}`)).toEqual({
      ids: [crewneck.id, boot.id].sort(),
      count: 2,
    })
    expect(await listOf(`tagId=${cotton.id}&tagId=${leather.id}&q=Crewneck`)).toEqual({
      ids: [crewneck.id],
      count: 1,
    })
    expect(await listOf(`tagId=${otherCasing.id}`)).toEqual({ ids: [], count: 0 })

    // An update replaces the whole set: the dropped Tag no longer matches, and [] clears them.
    const replaced = await api.patch<typeof productByIdRoutes.PatchOutput>(`/admin/products/${crewneck.id}`, {
      tagIds: [cotton.id, otherCasing.id],
    })
    expect(replaced.body.product.tags.map((tag) => tag.id).sort()).toEqual([cotton.id, otherCasing.id].sort())
    expect(await listOf(`tagId=${leather.id}`)).toEqual({ ids: [boot.id], count: 1 })
    const cleared = await api.patch<typeof productByIdRoutes.PatchOutput>(`/admin/products/${untagged.id}`, {
      tagIds: [],
    })
    expect(cleared.body.product.tags).toEqual([])

    // Deleting a Tag in use is allowed: its products stay, lose it, and no longer match it.
    const deleted = await api.delete(`/admin/product-tags/${cotton.id}`)
    expect(deleted.status).toBe(200)
    const missing = await api.get<ApiErrorBody>(`/admin/product-tags/${cotton.id}`)
    expect(missing.status).toBe(404)
    const afterDelete = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${crewneck.id}`)
    expect(afterDelete.status).toBe(200)
    expect(afterDelete.body.product.tags.map((tag) => tag.id)).toEqual([otherCasing.id])
    expect(await listOf(`tagId=${cotton.id}`)).toEqual({ ids: [], count: 0 })
    const listed = await api.get<typeof productTagRoutes.GetOutput>('/admin/product-tags')
    expect(listed.body.tags.map((tag) => tag.id).sort()).toEqual([leather.id, otherCasing.id].sort())
    // A deleted Tag's value is free again.
    await createTag('cotton')
  })
})
