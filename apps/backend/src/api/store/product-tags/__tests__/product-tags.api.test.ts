import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import adminCategoryDefinitions from '../../../admin/product-categories/definitions.js'
import type * as adminCategoryRoutes from '../../../admin/product-categories/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import productTagDefinitions from '../definitions.js'
import type * as productTagRoutes from '../route.js'

let api: TestApi

/** The store's default market: every store product read is priced, and the price factory writes USD. */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({ definitions: [...adminCategoryDefinitions, ...productTagDefinitions, ...productDefinitions] })
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  await factories.create.store({ defaultRegionId: region.id })
})

test.describe('Filter by tag', () => {
  test('a shopper narrows a list by any of several Tags, from chips that follow the list’s scope', async ({
    expect,
    http,
    service,
  }) => {
    const createCategory = async (body: object) => {
      const response = await api.post<typeof adminCategoryRoutes.PostOutput>(
        '/admin/product-categories',
        http.admin.createProductCategory({ isActive: true, ...body }),
      )
      expect(response.status).toBe(201)
      return response.body.productCategory
    }
    const tops = await createCategory({})
    const shoes = await createCategory({})
    const sneakers = await createCategory({ parentId: shoes.id })

    const tag = async (value: string) => (await service.create.productTag(api.container, { value })).id
    const cotton = await tag('cotton')
    const leather = await tag('leather')
    const canvas = await tag('canvas')
    const nylon = await tag('nylon')
    const wool = await tag('wool')

    const product = async ({
      priced = true,
      status = 'published' as const,
      ...overrides
    }: {
      priced?: boolean
      status?: 'published' | 'draft'
      title?: string
      categoryIds?: string[]
      tagIds?: string[]
    }) => {
      const { product } = await service.create.product(api.container, { status, ...overrides })
      const [variant] = await service.create.productVariants(api.container, product.id)
      if (!variant) throw new Error('Expected a variant')
      if (priced) await service.create.variantPrices(api.container, [variant.id])
      return product
    }
    const tee = await product({ title: 'Organic Tee', categoryIds: [tops.id], tagIds: [cotton] })
    const boot = await product({ title: 'Leather Boot', categoryIds: [shoes.id], tagIds: [leather] })
    const plimsoll = await product({ title: 'Canvas Plimsoll', categoryIds: [sneakers.id], tagIds: [canvas, cotton] })
    // Tags only an unsellable product carries are never offered: a chip would lead to an empty list.
    await product({ priced: false, categoryIds: [shoes.id], tagIds: [nylon] })
    await product({ status: 'draft', categoryIds: [tops.id], tagIds: [wool] })
    await product({ title: 'Plain Sock' })

    const listOf = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((item) => item.id).sort(), count: response.body.count }
    }
    const tagValues = async (query: string) => {
      const response = await api.get<typeof productTagRoutes.GetOutput>(`/store/product-tags?${query}`)
      expect(response.status).toBe(200)
      return response.body.values
    }

    // One tag, then two: any of them, in the page and its count alike.
    expect(await listOf('tag=leather')).toEqual({ ids: [boot.id], count: 1 })
    expect(await listOf('tag=leather&tag=canvas')).toEqual({ ids: [boot.id, plimsoll.id].sort(), count: 2 })
    // ANDed with the other filters: the Category and the shopper's search.
    expect(await listOf(`tag=cotton&category=${shoes.handle}`)).toEqual({ ids: [plimsoll.id], count: 1 })
    expect(await listOf('tag=cotton&q=Organic')).toEqual({ ids: [tee.id], count: 1 })
    // An unknown value matches nothing; Tag values are exact, so another casing is another value.
    expect(await listOf('tag=Cotton')).toEqual({ ids: [], count: 0 })

    // The chips: every value on the sellable list, sorted, whatever is already chosen.
    expect(await tagValues('')).toEqual(['canvas', 'cotton', 'leather'])
    expect(await tagValues('tag=leather')).toEqual(['canvas', 'cotton', 'leather'])
    // They follow the Category scope, its descendants included, and the search.
    expect(await tagValues(`category=${shoes.handle}`)).toEqual(['canvas', 'cotton', 'leather'])
    expect(await tagValues(`category=${sneakers.handle}`)).toEqual(['canvas', 'cotton'])
    expect(await tagValues(`category=${tops.handle}`)).toEqual(['cotton'])
    expect(await tagValues('q=Boot')).toEqual(['leather'])
    expect(await tagValues('q=Sock')).toEqual([])
  })
})
