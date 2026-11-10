import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import adminCollectionDefinitions from '../../../admin/collections/definitions.js'
import type * as adminCollectionRoutes from '../../../admin/collections/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import storeCollectionDefinitions from '../definitions.js'
import type * as storeCollectionRoutes from '../route.js'

let api: TestApi

/** The store's default market: every store product read is priced, and the price factory writes USD. */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({
    definitions: [...adminCollectionDefinitions, ...storeCollectionDefinitions, ...productDefinitions],
  })
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  await factories.create.store({ defaultRegionId: region.id })
})

test.describe('Collection pages', () => {
  test('the store reads Collections by handle and lists a Collection’s sellable members', async ({
    expect,
    http,
    service,
  }) => {
    const createCollection = async (body: object) => {
      const response = await api.post<typeof adminCollectionRoutes.PostOutput>(
        '/admin/collections',
        http.admin.createProductCollection(body),
      )
      expect(response.status).toBe(201)
      return response.body.collection
    }
    const essentials = await createCollection({ title: 'Essentials', thumbnail: 'https://cdn.example.com/e.jpg' })
    const active = await createCollection({ title: 'Active' })
    await createCollection({ title: 'Archive' })

    const collectionsBy = async (query: string) => {
      const response = await api.get<typeof storeCollectionRoutes.GetOutput>(`/store/collections?${query}`)
      expect(response.status).toBe(200)
      return response.body
    }
    // One handle: the hero's fields, and nothing the admin alone reads.
    expect((await collectionsBy(`handle=${essentials.handle}`)).collections).toEqual([
      { id: essentials.id, title: 'Essentials', handle: 'essentials', thumbnail: 'https://cdn.example.com/e.jpg' },
    ])
    // Several handles match any of them; an unknown handle matches nothing.
    const several = await collectionsBy(`handle=${essentials.handle}&handle=${active.handle}&handle=no-such`)
    expect(several.collections.map((collection) => collection.id).sort()).toEqual([essentials.id, active.id].sort())
    expect(several.count).toBe(2)
    expect(await collectionsBy('handle=no-such-collection')).toMatchObject({ collections: [], count: 0 })

    const product = async ({ priced = true, collectionIds = [] }: { priced?: boolean; collectionIds?: string[] }) => {
      const { product } = await service.create.product(api.container, { status: 'published' })
      const [variant] = await service.create.productVariants(api.container, product.id)
      if (!variant) throw new Error('Expected a variant')
      if (priced) await service.create.variantPrices(api.container, [variant.id])
      await Promise.all(
        collectionIds.map((collectionId) =>
          api.post(`/admin/collections/${collectionId}/products`, { add: [product.id] }),
        ),
      )
      return product
    }
    const hoodie = await product({ collectionIds: [essentials.id, active.id] })
    const tee = await product({ collectionIds: [essentials.id] })
    const shorts = await product({ collectionIds: [active.id] })
    // A member this market cannot price is not on the page: the collection filter is ANDed with the sellable ids.
    await product({ priced: false, collectionIds: [essentials.id] })
    await product({})

    const listIn = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((item) => item.id).sort(), count: response.body.count }
    }

    expect(await listIn(`collection=${essentials.handle}`)).toEqual({ ids: [hoodie.id, tee.id].sort(), count: 2 })
    expect(await listIn(`collection=${active.handle}`)).toEqual({ ids: [hoodie.id, shorts.id].sort(), count: 2 })
    // ANDed with the shopper's search, in the page and its count alike.
    expect(await listIn(`collection=${essentials.handle}&q=${encodeURIComponent(tee.title)}`)).toEqual({
      ids: [tee.id],
      count: 1,
    })
    expect(await listIn('collection=no-such-collection')).toEqual({ ids: [], count: 0 })

    // A deleted Collection lists nothing, and is no longer found by its handle.
    const deleted = await api.delete(`/admin/collections/${active.id}`)
    expect(deleted.status).toBe(200)
    expect(await listIn(`collection=${active.handle}`)).toEqual({ ids: [], count: 0 })
    expect(await collectionsBy(`handle=${active.handle}`)).toMatchObject({ collections: [], count: 0 })

    // Unscoped, the list is the whole sellable catalogue.
    expect((await listIn('limit=100')).count).toBe(4)
  })
})
