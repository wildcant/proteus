import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import type * as productByIdRoutes from '../../products/[id]/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import type * as productTypeByIdRoutes from '../[id]/route.js'
import productTypeDefinitions from '../definitions.js'
import type * as productTypeRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...productTypeDefinitions, ...productDefinitions] })
})

test.describe('Product Types', () => {
  test('a merchant names, renames and deletes Types, and the product list filters by them', async ({
    expect,
    service,
  }) => {
    const createType = async (value: string) => {
      const response = await api.post<typeof productTypeRoutes.PostOutput>('/admin/product-types', { value })
      expect(response.status).toBe(201)
      return response.body.type
    }
    const tShirt = await createType('T-shirt')
    const sneakers = await createType('Sneakers')

    // Uniqueness is exact: a taken value is DUPLICATE_ERROR, another casing is a new Type.
    const duplicate = await api.post<ApiErrorBody>('/admin/product-types', { value: 'T-shirt' })
    expect(duplicate.status).toBe(422)
    expect(duplicate.body.type).toBe(ErrorTypes.DUPLICATE_ERROR)
    const otherCasing = await createType('t-shirt')

    const renamed = await api.patch<typeof productTypeByIdRoutes.PatchOutput>(`/admin/product-types/${sneakers.id}`, {
      value: 'Running Shoes',
    })
    expect(renamed.status).toBe(200)
    expect(renamed.body.type.value).toBe('Running Shoes')
    const fetched = await api.get<typeof productTypeByIdRoutes.GetOutput>(`/admin/product-types/${sneakers.id}`)
    expect(fetched.body.type.value).toBe('Running Shoes')
    const takenOnRename = await api.patch<ApiErrorBody>(`/admin/product-types/${sneakers.id}`, { value: 'T-shirt' })
    expect(takenOnRename.status).toBe(422)
    expect(takenOnRename.body.type).toBe(ErrorTypes.DUPLICATE_ERROR)

    const searched = await api.get<typeof productTypeRoutes.GetOutput>('/admin/product-types?q=running')
    expect(searched.body.types.map((type) => type.id)).toEqual([sneakers.id])
    expect(searched.body.count).toBe(1)

    // From the product: create sets the Type, and the response embeds it.
    const created = await api.post<typeof productRoutes.PostOutput>('/admin/products', {
      title: 'Crewneck',
      typeId: tShirt.id,
    })
    expect(created.status).toBe(201)
    const crewneck = created.body.product
    expect(crewneck.type).toMatchObject({ id: tShirt.id, value: 'T-shirt' })

    // An unknown Type is NOT_FOUND on both product routes.
    const unknownOnCreate = await api.post<ApiErrorBody>('/admin/products', { title: 'Ghost', typeId: 'ptyp_missing' })
    expect(unknownOnCreate.status).toBe(404)
    const unknownOnUpdate = await api.patch<ApiErrorBody>(`/admin/products/${crewneck.id}`, { typeId: 'ptyp_missing' })
    expect(unknownOnUpdate.status).toBe(404)

    const { product: runner } = await service.create.product(api.container, { typeId: sneakers.id })
    const { product: untyped } = await service.create.product(api.container)

    const listOf = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/admin/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((product) => product.id).sort(), count: response.body.count }
    }
    expect(await listOf(`typeId=${tShirt.id}`)).toEqual({ ids: [crewneck.id], count: 1 })
    // A repeated key matches either Type; ANDed with the other filters in the page and its count.
    expect(await listOf(`typeId=${tShirt.id}&typeId=${sneakers.id}`)).toEqual({
      ids: [crewneck.id, runner.id].sort(),
      count: 2,
    })
    expect(await listOf(`typeId=${tShirt.id}&typeId=${sneakers.id}&q=Crewneck`)).toEqual({
      ids: [crewneck.id],
      count: 1,
    })
    expect(await listOf(`typeId=${otherCasing.id}`)).toEqual({ ids: [], count: 0 })

    // An update changes the Type, and null clears it.
    const moved = await api.patch<typeof productByIdRoutes.PatchOutput>(`/admin/products/${untyped.id}`, {
      typeId: tShirt.id,
    })
    expect(moved.body.product.type?.id).toBe(tShirt.id)
    const cleared = await api.patch<typeof productByIdRoutes.PatchOutput>(`/admin/products/${untyped.id}`, {
      typeId: null,
    })
    expect(cleared.body.product.type).toBeNull()
    expect(cleared.body.product.typeId).toBeNull()

    // Deleting a Type in use is allowed: its products stay, and read no Type.
    const deleted = await api.delete(`/admin/product-types/${tShirt.id}`)
    expect(deleted.status).toBe(200)
    const missing = await api.get<ApiErrorBody>(`/admin/product-types/${tShirt.id}`)
    expect(missing.status).toBe(404)
    const afterDelete = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${crewneck.id}`)
    expect(afterDelete.status).toBe(200)
    expect(afterDelete.body.product.type).toBeNull()
    const listed = await api.get<typeof productTypeRoutes.GetOutput>('/admin/product-types')
    expect(listed.body.types.map((type) => type.id).sort()).toEqual([sneakers.id, otherCasing.id].sort())
  })
})
