import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import adminCategoryDefinitions from '../../../admin/product-categories/definitions.js'
import type * as adminCategoryRoutes from '../../../admin/product-categories/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import productFilterDefinitions from '../definitions.js'
import type * as productFilterRoutes from '../route.js'

let api: TestApi

/** The store's default market: every store product read is priced, and the price factory writes USD. */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({
    definitions: [...adminCategoryDefinitions, ...productFilterDefinitions, ...productDefinitions],
  })
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  await factories.create.store({ defaultRegionId: region.id })
})

test.describe('Filter by metafield', () => {
  test('a shopper narrows a list by metafield values, from filters whose counts follow every other choice', async ({
    expect,
    http,
    service,
  }) => {
    const createCategory = async () => {
      const response = await api.post<typeof adminCategoryRoutes.PostOutput>(
        '/admin/product-categories',
        http.admin.createProductCategory({ isActive: true }),
      )
      expect(response.status).toBe(201)
      return response.body.productCategory
    }
    const apparel = await createCategory()
    const footwear = await createCategory()

    // Declared Tipo first: the filters come in the structure file's order, not the keys'.
    await service.create.metafieldDefinitions(api.container, [
      { key: 'tipo', name: 'Tipo', filterable: true },
      { key: 'genero', name: 'Género', filterable: true },
      { key: 'colecciones', name: 'Colecciones' },
    ])
    const cotton = (await service.create.productTag(api.container, { value: 'cotton' })).id

    const product = async ({
      priced = true,
      status = 'published' as const,
      ...overrides
    }: {
      priced?: boolean
      status?: 'published' | 'draft'
      categoryIds?: string[]
      tagIds?: string[]
      metafields?: Record<string, string[]>
    }) => {
      const { product } = await service.create.product(api.container, { status, ...overrides })
      const [variant] = await service.create.productVariants(api.container, product.id)
      if (!variant) throw new Error('Expected a variant')
      if (priced) await service.create.variantPrices(api.container, [variant.id])
      return product
    }
    const blouse = await product({
      categoryIds: [apparel.id],
      tagIds: [cotton],
      metafields: { genero: ['women'], tipo: ['tops'], colecciones: ['featured'] },
    })
    const skirt = await product({ categoryIds: [apparel.id], metafields: { genero: ['women'], tipo: ['bottoms'] } })
    const hoodie = await product({
      categoryIds: [apparel.id],
      metafields: { genero: ['men', 'unisex'], tipo: ['tops'] },
    })
    const boot = await product({ categoryIds: [footwear.id], metafields: { genero: ['men'], tipo: ['shoes'] } })
    // Values only an unsellable product holds are never offered: they would lead to an empty list.
    await product({ priced: false, categoryIds: [apparel.id], metafields: { genero: ['kids'], tipo: ['hats'] } })
    await product({ status: 'draft', categoryIds: [apparel.id], metafields: { tipo: ['socks'] } })

    const listOf = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query}`)
      expect(response.status).toBe(200)
      return { ids: response.body.products.map((item) => item.id).sort(), count: response.body.count }
    }
    const filtersOf = async (query: string) => {
      const response = await api.get<typeof productFilterRoutes.GetOutput>(`/store/product-filters?${query}`)
      expect(response.status).toBe(200)
      return Object.fromEntries(
        response.body.filters.map((filter) => [
          `${filter.name} (${filter.key})`,
          filter.values.map(({ value, count }) => `${value} ${count}`),
        ]),
      )
    }
    const sorted = (...ids: string[]) => ids.sort()

    // One value; two values of one key widen (OR); two keys narrow (AND), as do the Category and the Tag.
    expect(await listOf('filter=genero:women')).toEqual({ ids: sorted(blouse.id, skirt.id), count: 2 })
    expect(await listOf('filter=tipo:bottoms&filter=tipo:shoes')).toEqual({ ids: sorted(skirt.id, boot.id), count: 2 })
    expect(await listOf('filter=genero:men&filter=tipo:tops')).toEqual({ ids: [hoodie.id], count: 1 })
    expect(await listOf(`filter=genero:men&category=${footwear.handle}`)).toEqual({ ids: [boot.id], count: 1 })
    expect(await listOf('filter=tipo:tops&tag=cotton')).toEqual({ ids: [blouse.id], count: 1 })
    // An unknown key or value matches nothing; a selection without a key is refused.
    expect(await listOf('filter=talla:m')).toEqual({ ids: [], count: 0 })
    expect(await listOf('filter=genero:Women')).toEqual({ ids: [], count: 0 })
    expect((await api.get('/store/products?filter=women')).status).toBe(400)

    // Only the filterable definitions, in file order, each value sorted with the products it would keep.
    expect(await filtersOf('')).toEqual({
      'Tipo (tipo)': ['bottoms 1', 'shoes 1', 'tops 2'],
      'Género (genero)': ['men 2', 'unisex 1', 'women 2'],
    })
    // A choice narrows the other filter's counts but not its own: the values a shopper may add to it
    // keep counting the products they would bring in. A value nothing would keep stays, at 0.
    expect(await filtersOf('filter=genero:women')).toEqual({
      'Tipo (tipo)': ['bottoms 1', 'shoes 0', 'tops 1'],
      'Género (genero)': ['men 2', 'unisex 1', 'women 2'],
    })
    expect(await filtersOf('filter=genero:women&filter=tipo:tops')).toEqual({
      'Tipo (tipo)': ['bottoms 1', 'shoes 0', 'tops 1'],
      'Género (genero)': ['men 1', 'unisex 1', 'women 1'],
    })
    // The chosen Tag narrows every count.
    expect(await filtersOf('tag=cotton')).toEqual({
      'Tipo (tipo)': ['bottoms 0', 'shoes 0', 'tops 1'],
      'Género (genero)': ['men 0', 'unisex 0', 'women 1'],
    })
    // The values follow the list's scope: a Category offers only what its products hold.
    expect(await filtersOf(`category=${apparel.handle}`)).toEqual({
      'Tipo (tipo)': ['bottoms 1', 'tops 2'],
      'Género (genero)': ['men 1', 'unisex 1', 'women 2'],
    })
    expect(await filtersOf(`category=${footwear.handle}&filter=tipo:tops`)).toEqual({
      'Tipo (tipo)': ['shoes 1'],
      'Género (genero)': ['men 0'],
    })
  })
})

test.describe('Filter by brand', () => {
  test('the vendor field filters and counts by brand like a metafield, ignoring case', async ({ expect, service }) => {
    await service.create.metafieldDefinitions(api.container, [
      { key: 'marca', name: 'Marca', filterable: true, source: 'vendor' },
      { key: 'genero', name: 'Género', filterable: true },
    ])
    const product = async (brand: string | null, metafields: Record<string, string[]>) => {
      const { product } = await service.create.product(api.container, { status: 'published', brand, metafields })
      const [variant] = await service.create.productVariants(api.container, product.id)
      if (!variant) throw new Error('Expected a variant')
      await service.create.variantPrices(api.container, [variant.id])
      return product
    }
    const nikeMen = await product('Nike', { genero: ['men'] })
    const nikeWomen = await product('NIKE', { genero: ['women'] })
    const nikeKids = await product('Nike', { genero: ['kids'] })
    const adidasMen = await product('Adidas', { genero: ['men'] })
    await product(null, { genero: ['women'] })

    const listOf = async (query: string) => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query}`)
      expect(response.status).toBe(200)
      return response.body.products.map((item) => item.id).sort()
    }
    const filtersOf = async (query: string) => {
      const response = await api.get<typeof productFilterRoutes.GetOutput>(`/store/product-filters?${query}`)
      expect(response.status).toBe(200)
      return Object.fromEntries(
        response.body.filters.map((filter) => [
          filter.key,
          filter.values.map(({ value, count }) => `${value} ${count}`),
        ]),
      )
    }
    const sorted = (...ids: string[]) => ids.sort()

    // Any spelling of the brand selects it; two brands widen (OR); a metafield narrows (AND).
    expect(await listOf('filter=marca:nike')).toEqual(sorted(nikeMen.id, nikeWomen.id, nikeKids.id))
    expect(await listOf('filter=marca:Nike&filter=marca:adidas')).toEqual(
      sorted(nikeMen.id, nikeWomen.id, nikeKids.id, adidasMen.id),
    )
    expect(await listOf('filter=marca:Nike&filter=genero:men')).toEqual([nikeMen.id])
    expect(await listOf('filter=marca:Puma')).toEqual([])

    // The list items carry the brand.
    const page = await api.get<typeof productRoutes.GetOutput>('/store/products?filter=genero:men')
    expect(page.body.products.map((item) => item.brand).sort()).toEqual(['Adidas', 'Nike'])

    // In file order. Spellings that differ only in case are one value, shown as most products write
    // it; a product with no brand offers none.
    expect(await filtersOf('')).toEqual({ marca: ['Adidas 1', 'Nike 3'], genero: ['kids 1', 'men 2', 'women 2'] })
    // A brand choice narrows the other filter, not its own.
    expect(await filtersOf('filter=marca:nike')).toEqual({
      marca: ['Adidas 1', 'Nike 3'],
      genero: ['kids 1', 'men 1', 'women 1'],
    })
    expect(await filtersOf('filter=genero:women')).toEqual({
      marca: ['Adidas 0', 'Nike 1'],
      genero: ['kids 1', 'men 2', 'women 2'],
    })
  })
})
