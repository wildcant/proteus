import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import adminCategoryDefinitions from '../../../admin/product-categories/definitions.js'
import type * as adminCategoryRoutes from '../../../admin/product-categories/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import storeCategoryDefinitions from '../definitions.js'
import type * as storeCategoryRoutes from '../route.js'

let api: TestApi

/** The store's default market: every store product read is priced, and the price factory writes USD. */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({
    definitions: [...adminCategoryDefinitions, ...storeCategoryDefinitions, ...productDefinitions],
  })
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  await factories.create.store({ defaultRegionId: region.id })
})

test.describe('Shop by category', () => {
  test('the store sees only the Visible tree, and a category lists its Visible descendants too', async ({
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
    const men = await createCategory({ description: 'For him' })
    const tops = await createCategory({ parentId: men.id })
    const tees = await createCategory({ parentId: tops.id })
    // Hidden three ways: inactive, internal, and active under an inactive parent.
    const drafts = await createCategory({ parentId: men.id, isActive: false })
    const underDrafts = await createCategory({ parentId: drafts.id })
    const staffPicks = await createCategory({ parentId: men.id, isInternal: true })
    const archive = await createCategory({ isActive: false })
    await createCategory({ parentId: archive.id })
    const women = await createCategory({})

    const tree = await api.get<typeof storeCategoryRoutes.GetOutput>('/store/product-categories')
    expect(tree.status).toBe(200)
    expect(tree.body.productCategories).toEqual([
      {
        id: men.id,
        name: men.name,
        handle: men.handle,
        description: 'For him',
        children: [
          {
            id: tops.id,
            name: tops.name,
            handle: tops.handle,
            description: '',
            children: [{ id: tees.id, name: tees.name, handle: tees.handle, description: '', children: [] }],
          },
        ],
      },
      { id: women.id, name: women.name, handle: women.handle, description: '', children: [] },
    ])

    // One sellable product in each Category, and one in none.
    const sellableIn = async (categoryId?: string) => {
      const { product } = await service.create.product(api.container, { status: 'published' })
      const [variant] = await service.create.productVariants(api.container, product.id)
      if (!variant) throw new Error('Expected a variant')
      await service.create.variantPrices(api.container, [variant.id])
      if (categoryId) await api.post(`/admin/product-categories/${categoryId}/products`, { add: [product.id] })
      return product
    }
    const inMen = await sellableIn(men.id)
    const inTops = await sellableIn(tops.id)
    const inTees = await sellableIn(tees.id)
    await sellableIn(drafts.id)
    await sellableIn(underDrafts.id)
    await sellableIn(staffPicks.id)
    await sellableIn()

    const listIn = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((product) => product.id).sort(), count: response.body.count }
    }

    // The Category and its Visible descendants; the hidden branches under Men add nothing.
    expect(await listIn(`category=${men.handle}`)).toEqual({ ids: [inMen.id, inTops.id, inTees.id].sort(), count: 3 })
    expect(await listIn(`category=${tops.handle}`)).toEqual({ ids: [inTops.id, inTees.id].sort(), count: 2 })
    // ANDed with the shopper's search, in the page and its count alike.
    expect(await listIn(`category=${men.handle}&q=${encodeURIComponent(inTees.title)}`)).toEqual({
      ids: [inTees.id],
      count: 1,
    })
    // A hidden Category, one under a hidden parent, an internal one and an unknown handle match nothing.
    for (const handle of [drafts.handle, underDrafts.handle, staffPicks.handle, 'no-such-category']) {
      expect(await listIn(`category=${handle}`)).toEqual({ ids: [], count: 0 })
    }
    // Unscoped, the list is the whole sellable catalogue.
    expect((await listIn('limit=100')).count).toBe(7)
  })

  test('a product a child rule picks up is listed on the parent category too', async ({ expect, http, service }) => {
    const classics = await service.create.productTag(api.container, { value: 'estilo:clasicos' })
    const createCategory = async (body: object) => {
      const response = await api.post<typeof adminCategoryRoutes.PostOutput>(
        '/admin/product-categories',
        http.admin.createProductCategory({ isActive: true, ...body }),
      )
      expect(response.status).toBe(201)
      return response.body.productCategory
    }
    // The parent is manual and holds nothing directly; only the child's rule places the product.
    const men = await createCategory({})
    const menClassics = await createCategory({ parentId: men.id, rule: [[classics.value]] })

    const { product } = await service.create.product(api.container, { status: 'published', tagIds: [classics.id] })
    const [variant] = await service.create.productVariants(api.container, product.id)
    if (!variant) throw new Error('Expected a variant')
    await service.create.variantPrices(api.container, [variant.id])

    for (const handle of [menClassics.handle, men.handle]) {
      const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?category=${handle}`)
      expect(response.status).toBe(200)
      expect(response.body.products.map((listed) => listed.id)).toEqual([product.id])
    }
  })
})
