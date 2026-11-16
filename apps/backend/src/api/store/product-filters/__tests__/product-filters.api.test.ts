import { BigNumber } from '@core/bignumber.js'
import type { TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import catalogStructureDefinitions from '../../../admin/catalog-structure/definitions.js'
import type * as structureRoutes from '../../../admin/catalog-structure/route.js'
import adminCategoryDefinitions from '../../../admin/product-categories/definitions.js'
import type * as adminCategoryRoutes from '../../../admin/product-categories/route.js'
import type * as adminOptionRoutes from '../../../admin/product-options/[id]/route.js'
import adminOptionDefinitions from '../../../admin/product-options/definitions.js'
import uploadDefinitions from '../../../admin/uploads/definitions.js'
import type * as uploadRoutes from '../../../admin/uploads/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import productFilterDefinitions from '../definitions.js'
import type * as productFilterRoutes from '../route.js'

let api: TestApi

/** The store's default market: every store product read is priced, and the price factory writes USD. */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({
    definitions: [
      ...adminCategoryDefinitions,
      ...productFilterDefinitions,
      ...productDefinitions,
      ...catalogStructureDefinitions,
      ...uploadDefinitions,
      ...adminOptionDefinitions,
    ],
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

test.describe('Filter by option and price', () => {
  test('options filter and count like metafields, in their own order, and a price range narrows by any variant', async ({
    expect,
    service,
  }) => {
    await service.create.metafieldDefinitions(api.container, [{ key: 'genero', name: 'Género', filterable: true }])
    // Ranks out of alphabetical order: sizes are listed small to large, not as strings.
    const talla = await service.create.productOption(api.container, {
      title: 'Talla',
      values: [
        { value: '9', rank: 0 },
        { value: '10', rank: 1 },
        { value: '11', rank: 2 },
      ],
    })
    const color = await service.create.productOption(api.container, {
      title: 'Color',
      values: [
        { value: 'Negro', rank: 0 },
        { value: 'Blanco', rank: 1 },
      ],
    })
    const valueId = (option: typeof talla, value: string) => {
      const found = option.values.find((candidate) => candidate.value === value)
      if (!found) throw new Error(`No value ${value}`)
      return found.id
    }

    /** A product offering `colorValue` in each size of `prices`, each size its own variant at its own price. */
    const product = async (colorValue: string, prices: Record<string, number>, genero: string) => {
      const { product } = await service.create.product(api.container, {
        status: 'published',
        metafields: { genero: [genero] },
      })
      const sizes = Object.keys(prices)
      await service.update.productOptions(api.container, product.id, {
        options: [
          { optionId: talla.id, valueIds: sizes.map((size) => valueId(talla, size)) },
          { optionId: color.id, valueIds: [valueId(color, colorValue)] },
        ],
      })
      const variants = await service.create.productVariants(
        api.container,
        product.id,
        sizes.map((size) => ({
          optionValues: { [talla.id]: valueId(talla, size), [color.id]: valueId(color, colorValue) },
        })),
      )
      await Promise.all(
        variants.map((variant, index) =>
          service.create.variantPrices(api.container, [variant.id], {
            prices: [{ currencyCode: 'usd', amount: new BigNumber(prices[sizes[index] ?? ''] ?? 0) }],
          }),
        ),
      )
      return product
    }
    const runner = await product('Negro', { '9': 100, '10': 150 }, 'men')
    const court = await product('Blanco', { '10': 300, '11': 300 }, 'women')
    const boot = await product('Negro', { '11': 500 }, 'men')

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
          `${filter.name} (${filter.key})`,
          filter.values.map(({ value, count }) => `${value} ${count}`),
        ]),
      )
    }
    const sorted = (...ids: string[]) => ids.sort()

    // Sizes of one option widen (OR); another option or a metafield narrows (AND).
    expect(await listOf('filter=option.Talla:9')).toEqual([runner.id])
    expect(await listOf('filter=option.Talla:9&filter=option.Talla:11')).toEqual(sorted(runner.id, court.id, boot.id))
    expect(await listOf('filter=option.Talla:11&filter=option.Color:Negro')).toEqual([boot.id])
    expect(await listOf('filter=option.Talla:10&filter=genero:women')).toEqual([court.id])
    expect(await listOf('filter=option.Talla:12')).toEqual([])

    // After the metafields, each option by title, its values in the option's order.
    expect(await filtersOf('')).toEqual({
      'Género (genero)': ['men 2', 'women 1'],
      'Color (option.Color)': ['Negro 2', 'Blanco 1'],
      'Talla (option.Talla)': ['9 1', '10 2', '11 2'],
    })
    // An option's choice narrows the others' counts, not its own.
    expect(await filtersOf('filter=option.Color:Negro')).toEqual({
      'Género (genero)': ['men 2', 'women 0'],
      'Color (option.Color)': ['Negro 2', 'Blanco 1'],
      'Talla (option.Talla)': ['9 1', '10 1', '11 1'],
    })

    // A product is in the range when any variant is; either end may be left open.
    expect(await listOf('minPrice=120&maxPrice=300')).toEqual(sorted(runner.id, court.id))
    expect(await listOf('minPrice=301')).toEqual([boot.id])
    expect(await listOf('maxPrice=99')).toEqual([])
    expect(await listOf('maxPrice=150&filter=option.Color:Negro')).toEqual([runner.id])
    // The range narrows every count but never the values offered, so a range that keeps nothing
    // leaves every filter in place, at 0.
    expect(await filtersOf('minPrice=301')).toEqual({
      'Género (genero)': ['men 1', 'women 0'],
      'Color (option.Color)': ['Negro 1', 'Blanco 0'],
      'Talla (option.Talla)': ['9 0', '10 0', '11 1'],
    })
    expect(await filtersOf('maxPrice=99')).toEqual({
      'Género (genero)': ['men 0', 'women 0'],
      'Color (option.Color)': ['Negro 0', 'Blanco 0'],
      'Talla (option.Talla)': ['9 0', '10 0', '11 0'],
    })
  })
})

test.describe('Labels and value order', () => {
  test('a field value reads and ranks as the Category that selects exactly it, a brand and an option as written', async ({
    expect,
    http,
    service,
  }) => {
    await service.create.metafieldDefinitions(api.container, [
      { key: 'brand', name: 'Brand', filterable: true, source: 'vendor' },
      { key: 'gender', name: 'Gender', filterable: true },
      { key: 'style', name: 'Style', filterable: true },
    ])
    const createCategory = async (name: string, rank: number, rule: Record<string, string[]>) => {
      const response = await api.post(
        '/admin/product-categories',
        http.admin.createProductCategory({ name, rank, rule, isActive: true }),
      )
      expect(response.status).toBe(201)
    }
    // Running ranks before Classics: the filter lists styles as the menu does, not alphabetically. A
    // rule over two values names neither.
    await createCategory('Running', 0, { style: ['running'] })
    await createCategory('Classics', 1, { style: ['classics'] })
    await createCategory('All styles', 2, { style: ['classics', 'skate'] })
    const size = await service.create.productOption(api.container, {
      title: 'Size',
      values: [{ value: 'xl', rank: 0 }],
    })
    const sizeValueId = size.values[0]?.id ?? ''

    const product = async (brand: string, metafields: Record<string, string[]>) => {
      const { product } = await service.create.product(api.container, { status: 'published', brand, metafields })
      await service.update.productOptions(api.container, product.id, {
        options: [{ optionId: size.id, valueIds: [sizeValueId] }],
      })
      const [variant] = await service.create.productVariants(api.container, product.id, [
        { optionValues: { [size.id]: sizeValueId } },
      ])
      if (!variant) throw new Error('Expected a variant')
      await service.create.variantPrices(api.container, [variant.id])
    }
    // A lower-case brand stays as written: only a field's stored value is turned into a name.
    await product('adidas', { gender: ['men'], style: ['classics'] })
    await product('adidas', { gender: ['women'], style: ['skate'] })
    await product('adidas', { gender: ['women'], style: ['running'] })

    const response = await api.get<typeof productFilterRoutes.GetOutput>('/store/product-filters')
    expect(response.status).toBe(200)
    expect(
      Object.fromEntries(
        response.body.filters.map((filter) => [
          filter.key,
          filter.values.map(({ value, label }) => `${value}: ${label}`),
        ]),
      ),
    ).toEqual({
      brand: ['adidas: adidas'],
      // No Category names a gender: the value, capitalised.
      gender: ['men: Men', 'women: Women'],
      // Named and ordered by the Category that selects exactly each; one no Category names comes last.
      style: ['running: Running', 'classics: Classics', 'skate: Skate'],
      'option.Size': ['xl: xl'],
    })
  })
})

test.describe('Stock and price bounds', () => {
  test('a size nothing in view has left is sold out, and the slider spans the scope', async ({ expect, service }) => {
    const option = async (title: string, values: string[]) => {
      const created = await service.create.productOption(api.container, {
        title,
        values: values.map((value, rank) => ({ value, rank })),
      })
      const idOf = (value: string) => {
        const found = created.values.find((candidate) => candidate.value === value)
        if (!found) throw new Error(`No ${title} ${value}`)
        return found.id
      }
      return { id: created.id, idOf }
    }
    const size = await option('Size', ['40', '41'])
    const color = await option('Color', ['Café', 'Navy Blue'])

    /** A product in one colour, in each size of `stock` — units on the shelf by size — every variant at `amount`. */
    const product = async (title: string, colour: string, amount: number, stock: Record<string, number>) => {
      const { product } = await service.create.product(api.container, { title, status: 'published' })
      const sizes = Object.keys(stock)
      await service.update.productOptions(api.container, product.id, {
        options: [
          { optionId: color.id, valueIds: [color.idOf(colour)] },
          { optionId: size.id, valueIds: sizes.map(size.idOf) },
        ],
      })
      const variants = await service.create.productVariants(
        api.container,
        product.id,
        sizes.map((value) => ({ optionValues: { [color.id]: color.idOf(colour), [size.id]: size.idOf(value) } })),
      )
      await service.create.variantPrices(
        api.container,
        variants.map((variant) => variant.id),
        { prices: [{ currencyCode: 'usd', amount: new BigNumber(amount) }] },
      )
      await Promise.all(
        variants.map((variant, index) =>
          service.create.variantStock(api.container, {
            variantId: variant.id,
            level: { stockedQuantity: stock[sizes[index] ?? ''] ?? 0 },
          }),
        ),
      )
    }
    // Size 40 is on two products and sold out on both; 41 is left on one of its two.
    await product('Runner', 'Navy Blue', 120, { '40': 0, '41': 2 })
    await product('Court', 'Café', 180, { '40': 0 })
    await product('Trail', 'Navy Blue', 90, { '41': 0 })

    const filtersOf = async (query: string) => {
      const response = await api.get<typeof productFilterRoutes.GetOutput>(`/store/product-filters?${query}`)
      expect(response.status).toBe(200)
      const { filters, priceBounds } = response.body
      return {
        filters: Object.fromEntries(
          filters.map((filter) => [
            filter.key,
            filter.values.map(
              ({ value, count, soldOut, swatch }) =>
                `${value} ${count}${soldOut ? ' sold out' : ''}${swatch ? ` (${swatch})` : ''}`,
            ),
          ]),
        ),
        priceBounds,
      }
    }

    // Court has nothing left, so its colour is sold out as well as its size.
    expect(await filtersOf('')).toEqual({
      filters: {
        'option.Color': ['Café 1 sold out', 'Navy Blue 2'],
        'option.Size': ['40 2 sold out', '41 2'],
      },
      priceBounds: { min: '90', max: '180' },
    })
    // The bounds hold still while a range or a value is chosen, so the slider does not shrink under the shopper.
    expect((await filtersOf('minPrice=100&maxPrice=150&filter=option.Color:Café')).priceBounds).toEqual({
      min: '90',
      max: '180',
    })
    // A search narrows the scope, so both the stock answer and the bounds follow it: Trail's 41 is gone.
    expect(await filtersOf('q=trail')).toEqual({
      filters: { 'option.Color': ['Navy Blue 1 sold out'], 'option.Size': ['41 1 sold out'] },
      priceBounds: { min: '90', max: '90' },
    })
    // A scope nothing in view is priced in has no slider.
    expect((await filtersOf('q=nothing-matches')).priceBounds).toBeNull()
  })
})

test.describe('Search', () => {
  /**
   * The titles leave the brand out, as an imported catalogue's often do, so only the brand says a
   * pair is a Jordan. The list and its filters search alike, so each journey reads both.
   */
  const createCatalogue = async (service: Fixtures['service']) => {
    await service.create.metafieldDefinitions(api.container, [
      { key: 'marca', name: 'Marca', filterable: true, source: 'vendor' },
    ])
    const product = async (title: string, brand: string) => {
      const { product } = await service.create.product(api.container, { title, brand, status: 'published' })
      const [variant] = await service.create.productVariants(api.container, product.id)
      if (!variant) throw new Error('Expected a variant')
      await service.create.variantPrices(api.container, [variant.id])
      return product
    }
    return {
      retro: await product('Retro 1 Negro', 'Jordan'),
      dunk: await product('Dunk Low Blanco', 'Nike'),
    }
  }

  const searchOf = async (query: string) => {
    const [list, filters] = await Promise.all([
      api.get<typeof productRoutes.GetOutput>(`/store/products?${query}`),
      api.get<typeof productFilterRoutes.GetOutput>(`/store/product-filters?${query}`),
    ])
    return {
      ids: list.body.products.map((item) => item.id),
      correctedQuery: list.body.correctedQuery,
      brands: filters.body.filters
        .find((filter) => filter.key === 'marca')
        ?.values.map(({ value, count }) => `${value} ${count}`),
      filtersCorrectedQuery: filters.body.correctedQuery,
    }
  }

  test('a search word matches the brand, ignoring case, though no title holds it', async ({ expect, service }) => {
    const { retro } = await createCatalogue(service)

    expect(await searchOf('q=JORDAN')).toEqual({
      ids: [retro.id],
      correctedQuery: null,
      brands: ['Jordan 1'],
      filtersCorrectedQuery: null,
    })
  })

  test('every search word must match, each in the title or the brand', async ({ expect, service }) => {
    const { retro } = await createCatalogue(service)

    expect(await searchOf('q=jordan%20negro')).toEqual({
      ids: [retro.id],
      correctedQuery: null,
      brands: ['Jordan 1'],
      filtersCorrectedQuery: null,
    })
    // Each word is held somewhere, so nothing is corrected: the pair is just not in white.
    expect(await searchOf('q=jordan%20blanco')).toEqual({
      ids: [],
      correctedQuery: null,
      brands: [],
      filtersCorrectedQuery: null,
    })
  })

  test('a misspelt brand is corrected to the brand, and the words already held stay', async ({ expect, service }) => {
    const { retro } = await createCatalogue(service)

    expect(await searchOf('q=jordna%20Negro')).toEqual({
      ids: [retro.id],
      correctedQuery: 'jordan Negro',
      brands: ['Jordan 1'],
      filtersCorrectedQuery: 'jordan Negro',
    })
  })

  test('exact searches the term as typed', async ({ expect, service }) => {
    const { retro } = await createCatalogue(service)

    expect(await searchOf('q=jordna&exact=true')).toEqual({
      ids: [],
      correctedQuery: null,
      brands: [],
      filtersCorrectedQuery: null,
    })
    expect(await searchOf('q=jordan&exact=true')).toEqual({
      ids: [retro.id],
      correctedQuery: null,
      brands: ['Jordan 1'],
      filtersCorrectedQuery: null,
    })
  })
})

test.describe('Filter order', () => {
  test('the structure file’s filters decide which facets show, and in what order', async ({ expect, service }) => {
    await applyStructure(`
fields:
  - { name: Género, key: genero, filterable: true }
  - { name: Tipo, key: tipo, filterable: true }
filters: [option.Size, genero]
`)
    const size = await service.create.productOption(api.container, {
      title: 'Size',
      values: ['9', '10'].map((value, rank) => ({ value, rank })),
    })
    const product = async (genero: string, sizeValue: string) => {
      const { product } = await service.create.product(api.container, {
        status: 'published',
        metafields: { genero: [genero], tipo: ['shoes'] },
      })
      const valueId = size.values.find((value) => value.value === sizeValue)?.id ?? ''
      await service.update.productOptions(api.container, product.id, {
        options: [{ optionId: size.id, valueIds: [valueId] }],
      })
      const variants = await service.create.productVariants(api.container, product.id, [
        { optionValues: { [size.id]: valueId } },
      ])
      await service.create.variantPrices(
        api.container,
        variants.map((variant) => variant.id),
      )
    }
    await product('men', '9')
    await product('women', '10')

    const response = await api.get<typeof productFilterRoutes.GetOutput>('/store/product-filters')
    expect(response.status).toBe(200)
    // The Size option first, then Género; Tipo, though filterable, is not listed, so it is not shown.
    expect(response.body.filters.map((filter) => [filter.key, filter.values.map(({ value }) => value)])).toEqual([
      ['option.Size', ['9', '10']],
      ['genero', ['men', 'women']],
    ])
  })
})

async function applyStructure(text: string) {
  const upload = await api.request
    .post('/admin/uploads')
    .field('access', 'private')
    .attach('files', Buffer.from(text), { filename: 'catalog-structure.yaml', contentType: 'application/yaml' })
  const [file] = (upload.body as typeof uploadRoutes.PostOutput._zod.output).files
  const applied = await api.post<typeof structureRoutes.PostOutput>('/admin/catalog-structure', { fileId: file?.id })
  if (applied.status !== 200) throw new Error(`The structure was not applied: ${JSON.stringify(applied.body)}`)
}

test.describe('Option buckets', () => {
  test('an option with buckets is counted and filtered by bucket, a value in each bucket it reaches, with the bucket’s swatch, and regroups when its buckets change', async ({
    expect,
    service,
  }) => {
    // Each value joins every bucket holding one of its words: "Black / Red" is Black and Red.
    const colour = await service.create.productOption(api.container, {
      title: 'Color',
      values: ['Black / Red', 'Jet Black', 'Burgundy', 'Navy'].map((value, rank) => ({ value, rank })),
      buckets: [
        { name: 'Black', swatch: 'black', words: ['Black'] },
        { name: 'Red', swatch: 'red', words: ['red', 'burgundy'] },
      ],
    })
    const products = await Promise.all(
      colour.values.map(async (value) => {
        const { product } = await service.create.product(api.container, { title: value.value, status: 'published' })
        await service.update.productOptions(api.container, product.id, {
          options: [{ optionId: colour.id, valueIds: [value.id] }],
        })
        const variants = await service.create.productVariants(api.container, product.id, [
          { manageInventory: false, optionValues: { [colour.id]: value.id } },
        ])
        await service.create.variantPrices(
          api.container,
          variants.map((variant) => variant.id),
        )
        return [value.value, product.id] as const
      }),
    )
    const idOf = Object.fromEntries(products)

    const colourFacet = async () => {
      const response = await api.get<typeof productFilterRoutes.GetOutput>('/store/product-filters')
      expect(response.status).toBe(200)
      return response.body.filters
        .find((filter) => filter.key === 'option.Color')
        ?.values.map(
          ({ value, count, soldOut, swatch }) =>
            `${value} ${count}${soldOut ? ' sold out' : ''}${swatch ? ` (${swatch})` : ''}`,
        )
    }
    const listed = async (...selections: string[]) => {
      const query = selections.map((selection) => `filter=${encodeURIComponent(`option.Color:${selection}`)}`)
      const response = await api.get<typeof productRoutes.GetOutput>(`/store/products?${query.join('&')}`)
      expect(response.status).toBe(200)
      return response.body.products.map((product) => product.id).sort()
    }

    // Buckets in their order, then a value no bucket holds as itself.
    expect(await colourFacet()).toEqual(['Black 2 (black)', 'Red 2 (red)', 'Navy 1'])
    expect(await listed('Black')).toEqual([idOf['Black / Red'], idOf['Jet Black']].sort())
    expect(await listed('Red')).toEqual([idOf['Black / Red'], idOf.Burgundy].sort())
    // Both buckets chosen, a product in both is listed once.
    expect(await listed('Black', 'Red')).toEqual([idOf['Black / Red'], idOf['Jet Black'], idOf.Burgundy].sort())
    expect(await listed('Navy')).toEqual([idOf.Navy])
    // A bucketed value is chosen by its bucket, never by its own name.
    expect(await listed('Jet Black')).toEqual([])

    // Rewriting the buckets regroups every value at once: Navy now has one.
    const patched = await api.patch<typeof adminOptionRoutes.PatchOutput>(`/admin/product-options/${colour.id}`, {
      buckets: [
        { name: 'Black', swatch: 'black', words: ['black'] },
        { name: 'Red', swatch: 'red', words: ['red', 'burgundy'] },
        { name: 'Blue', swatch: 'blue', words: ['navy'] },
      ],
    })
    expect(patched.status).toBe(200)
    expect(await colourFacet()).toEqual(['Black 2 (black)', 'Red 2 (red)', 'Blue 1 (blue)'])
    expect(await listed('Blue')).toEqual([idOf.Navy])
  })
})

test.describe('Sale filter', () => {
  test('the structure file offers «On sale» while something is, counted under every other choice, and it narrows the other filters', async ({
    expect,
    service,
    dto,
  }) => {
    await applyStructure(`
fields:
  - { name: Género, key: genero, filterable: true }
filters: [genero, price.sale]
`)
    const product = async (genero: string, amount: string, compareAt: string | null) => {
      const { product } = await service.create.product(api.container, {
        status: 'published',
        metafields: { genero: [genero] },
      })
      const [variant] = await service.create.productVariants(api.container, product.id)
      if (!variant) throw new Error('Expected a variant')
      await service.create.variantPrices(api.container, [variant.id], {
        prices: [
          dto.generate.createPrice({
            amount: new BigNumber(amount),
            compareAtAmount: compareAt === null ? null : new BigNumber(compareAt),
          }),
        ],
      })
      await service.create.variantStock(api.container, { variantId: variant.id, level: { stockedQuantity: 2 } })
    }
    await product('men', '40', '60')
    await product('women', '50', '80')
    await product('women', '90', null)

    const facets = async (query = '') => {
      const response = await api.get<typeof productFilterRoutes.GetOutput>(`/store/product-filters${query}`)
      expect(response.status).toBe(200)
      return response.body.filters.map((filter) => [
        filter.key,
        filter.name,
        filter.values.map(({ value, label, count }) => [value, label, count]),
      ])
    }

    expect(await facets()).toEqual([
      [
        'genero',
        'Género',
        [
          ['men', 'Men', 1],
          ['women', 'Women', 2],
        ],
      ],
      ['price.sale', 'Sale', [['on', 'On sale', 2]]],
    ])
    // The sale count follows the other choices, and the sale choice narrows theirs.
    expect(await facets('?filter=genero:women')).toContainEqual(['price.sale', 'Sale', [['on', 'On sale', 1]]])
    expect(await facets('?filter=price.sale:on')).toEqual([
      [
        'genero',
        'Género',
        [
          ['men', 'Men', 1],
          ['women', 'Women', 1],
        ],
      ],
      ['price.sale', 'Sale', [['on', 'On sale', 2]]],
    ])
    // Nothing on sale under the choices: the filter is not offered, rather than offered at 0.
    expect((await facets('?filter=genero:women&minPrice=60')).map(([key]) => key)).toEqual(['genero'])

    const list = await api.get<typeof productRoutes.GetOutput>(
      '/store/products?filter=price.sale:on&filter=genero:women',
    )
    expect(list.body.count).toBe(1)
  })
})
