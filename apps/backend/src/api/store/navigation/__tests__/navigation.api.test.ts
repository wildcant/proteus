import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import catalogStructureDefinitions from '../../../admin/catalog-structure/definitions.js'
import type * as structureRoutes from '../../../admin/catalog-structure/route.js'
import uploadDefinitions from '../../../admin/uploads/definitions.js'
import type * as uploadRoutes from '../../../admin/uploads/route.js'
import navigationDefinitions from '../definitions.js'
import type * as navigationRoutes from '../route.js'

let api: TestApi

/** The store's default market: a `valores` section reads only what it can sell, and the price factory writes USD. */
test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({
    definitions: [...catalogStructureDefinitions, ...uploadDefinitions, ...navigationDefinitions],
  })
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  await factories.create.store({ defaultRegionId: region.id })
})

const STRUCTURE = `
campos:
  - { nombre: Marca, clave: marca, origen: vendor }
  - { nombre: Género, clave: genero }
  - { nombre: Modelo, clave: modelo }
categorias:
  - nombre: Hombre
    handle: hombre
    regla: { genero: [hombre] }
    hijos:
      - { nombre: Clásicos, handle: hombre-clasicos, regla: { genero: [hombre], modelo: [Superstar] } }
      - { nombre: Running, handle: hombre-running }
  - nombre: Mujer
    handle: mujer
    regla: { genero: [mujer] }
colecciones:
  - { nombre: Rebajas, handle: rebajas, regla: { modelo: [Gazelle, Old Skool] } }
menu:
  - categoria: hombre
    secciones:
      - { nombre: Estilos, mostrar: subcategorias }
      - { nombre: Marcas, mostrar: { valores: marca } }
      - { nombre: Modelos, mostrar: { valores: modelo, limite: 2 } }
      - nombre: Destacados
        enlaces:
          - { nombre: Superstar Adidas, filtro: { marca: [Adidas], modelo: [Superstar] } }
          - { coleccion: rebajas }
          - { nombre: Para ella, categoria: mujer }
  - categoria: mujer
    secciones:
      - { nombre: Estilos, mostrar: subcategorias }
      - { nombre: Marcas, mostrar: { valores: marca } }
  - coleccion: rebajas
    secciones:
      - { nombre: Modelos, mostrar: { valores: modelo } }
  - categoria: hombre-clasicos
`

test.describe('Store navigation', () => {
  test('resolves each menu section into links over the entry’s own sellable products', async ({ expect, service }) => {
    const upload = await api.request
      .post('/admin/uploads')
      .field('access', 'private')
      .attach('files', Buffer.from(STRUCTURE), { filename: 'estructura.yaml', contentType: 'application/yaml' })
    const [file] = (upload.body as typeof uploadRoutes.PostOutput._zod.output).files
    const applied = await api.post<typeof structureRoutes.PostOutput>('/admin/catalog-structure', { fileId: file?.id })
    expect(applied.status).toBe(200)

    const product = async ({
      priced = true,
      status = 'published' as const,
      ...overrides
    }: {
      brand: string
      metafields: Record<string, string[]>
      priced?: boolean
      status?: 'published' | 'draft'
    }) => {
      const { product } = await service.create.product(api.container, { status, ...overrides })
      const [variant] = await service.create.productVariants(api.container, product.id)
      if (!variant) throw new Error('Expected a variant')
      if (priced) await service.create.variantPrices(api.container, [variant.id])
    }
    await product({ brand: 'Adidas', metafields: { genero: ['hombre'], modelo: ['Superstar'] } })
    await product({ brand: 'Nike', metafields: { genero: ['hombre'], modelo: ['Cortez'] } })
    await product({ brand: 'Adidas', metafields: { genero: ['hombre'], modelo: ['Gazelle'] } })
    await product({ brand: 'Vans', metafields: { genero: ['mujer'], modelo: ['Old Skool'] } })
    // Values only an unsellable product holds are never linked: they would lead to an empty list.
    await product({ brand: 'Puma', metafields: { genero: ['hombre'], modelo: ['Suede'] }, priced: false })
    await product({ brand: 'Reebok', metafields: { genero: ['hombre'], modelo: ['Club'] }, status: 'draft' })

    const response = await api.get<typeof navigationRoutes.GetOutput>('/store/navigation')
    expect(response.status).toBe(200)

    const list = (
      type: 'category' | 'collection',
      handle: string,
      label: string,
      filters: [string, string][] = [],
    ) => ({
      label,
      type,
      handle,
      filters: filters.map(([key, value]) => ({ key, value })),
    })
    const column = (name: string, links: ReturnType<typeof list>[], extra = {}) => ({
      name,
      display: 'list',
      links,
      viewAll: null,
      note: null,
      ...extra,
    })
    expect(response.body.navigation).toEqual([
      {
        type: 'category',
        handle: 'hombre',
        sections: [
          // Closed by a "View all" of the entry's own list.
          column(
            'Estilos',
            [list('category', 'hombre-clasicos', 'Clásicos'), list('category', 'hombre-running', 'Running')],
            { viewAll: { label: null, type: 'category', handle: 'hombre', filters: [] } },
          ),
          // Sorted, each brand once, read off the Category's products alone.
          column('Marcas', [
            list('category', 'hombre', 'Adidas', [['marca', 'Adidas']]),
            list('category', 'hombre', 'Nike', [['marca', 'Nike']]),
          ]),
          // Cut at `limite`: Superstar is the third.
          column('Modelos', [
            list('category', 'hombre', 'Cortez', [['modelo', 'Cortez']]),
            list('category', 'hombre', 'Gazelle', [['modelo', 'Gazelle']]),
          ]),
          column('Destacados', [
            list('category', 'hombre', 'Superstar Adidas', [
              ['marca', 'Adidas'],
              ['modelo', 'Superstar'],
            ]),
            // Labelled by the Collection's own name, as the file names none.
            list('collection', 'rebajas', 'Rebajas'),
            list('category', 'mujer', 'Para ella'),
          ]),
        ],
        footer: [],
      },
      // Mujer has no children, so its Estilos is left with no links and is not served.
      {
        type: 'category',
        handle: 'mujer',
        sections: [column('Marcas', [list('category', 'mujer', 'Vans', [['marca', 'Vans']])])],
        footer: [],
      },
      // A Collection's values are its own members'.
      {
        type: 'collection',
        handle: 'rebajas',
        sections: [
          column('Modelos', [
            list('collection', 'rebajas', 'Gazelle', [['modelo', 'Gazelle']]),
            list('collection', 'rebajas', 'Old Skool', [['modelo', 'Old Skool']]),
          ]),
        ],
        footer: [],
      },
      // No secciones: the store shows the Category with its children, as before.
      { type: 'category', handle: 'hombre-clasicos', sections: [], footer: [] },
    ])
  })

  test('groups a field’s values by another, most products first, draws an option’s sizes as chips, and adds the entry’s footer', async ({
    expect,
    service,
  }) => {
    await applyStructure(`
campos:
  - { nombre: Marca, clave: marca, origen: vendor }
  - { nombre: Tipo, clave: tipo, origen: type }
  - { nombre: Modelo, clave: modelo }
categorias:
  - nombre: Tenis
    handle: tenis
    regla: { tipo: [tenis] }
colecciones:
  - { nombre: Los más buscados, handle: los-mas-buscados, regla: { modelo: [Samba] } }
menu:
  - categoria: tenis
    secciones:
      - nombre: Todos los tenis
        enlaces: [ { coleccion: los-mas-buscados } ]
      - nombre: Marcas
        mostrar: { valores: modelo, agrupar: marca, grupos: 2, limite: 2 }
      - nombre: Talla
        mostrar: { opcion: Talla }
        nota: Te mostramos solo lo que hay en tu talla.
    pie:
      - { nombre: Ver todas las marcas, categoria: tenis }
`)
    // The Type is matched ignoring case: the CSV writes "Tenis", the rule "tenis".
    const tenis = await service.create.productType(api.container, { value: 'Tenis' })
    const botas = await service.create.productType(api.container, { value: 'Botas' })
    const talla = await service.create.productOption(api.container, {
      title: 'Talla',
      // One rank for all, as an import leaves them: sizes still come as numbers, 9 before 10.
      values: [
        { value: '10', rank: 0 },
        { value: '11', rank: 0 },
        { value: '9', rank: 0 },
      ],
    })
    const sizeId = (size: string) => talla.values.find((value) => value.value === size)?.id ?? ''

    const product = async (brand: string, modelo: string, sizes: string[] = [], typeId = tenis.id) => {
      const { product } = await service.create.product(api.container, {
        status: 'published',
        brand,
        typeId,
        metafields: { modelo: [modelo] },
      })
      if (sizes.length > 0) {
        await service.update.productOptions(api.container, product.id, {
          options: [{ optionId: talla.id, valueIds: sizes.map(sizeId) }],
        })
      }
      const variants = await service.create.productVariants(
        api.container,
        product.id,
        sizes.length > 0 ? sizes.map((size) => ({ optionValues: { [talla.id]: sizeId(size) } })) : [{}],
      )
      await service.create.variantPrices(
        api.container,
        variants.map((variant) => variant.id),
      )
      return product
    }
    await product('Adidas', 'Samba', ['10'])
    await product('Adidas', 'Samba', ['9'])
    await product('Adidas', 'Superstar')
    await product('Adidas', 'Campus')
    await product('Nike', 'TN')
    const dunk = await product('Nike', 'Dunk')
    // A third brand, past `grupos`.
    await product('Vans', 'Knu Skool')
    // Not a tenis: its brand and size are not offered.
    await product('Timberland', 'Bota 6', ['11'], botas.id)

    const list = (label: string, filters: [string, string][] = [], type: 'category' | 'collection' = 'category') => ({
      label,
      type,
      handle: type === 'category' ? 'tenis' : 'los-mas-buscados',
      filters: filters.map(([key, value]) => ({ key, value })),
    })
    const brandColumn = (brand: string, models: string[]) => ({
      name: brand,
      display: 'list',
      links: models.map((model) =>
        list(model, [
          ['marca', brand],
          ['modelo', model],
        ]),
      ),
      viewAll: { label: brand, type: 'category', handle: 'tenis', filters: [{ key: 'marca', value: brand }] },
      note: null,
    })
    const navigation = async () =>
      (await api.get<typeof navigationRoutes.GetOutput>('/store/navigation')).body.navigation

    expect(await navigation()).toEqual([
      {
        type: 'category',
        handle: 'tenis',
        sections: [
          {
            name: 'Todos los tenis',
            display: 'list',
            links: [list('Los más buscados', [], 'collection')],
            viewAll: null,
            note: null,
          },
          // One column per brand, most products first; in each, most products first, then alphabetically, cut at 2.
          brandColumn('Adidas', ['Samba', 'Campus']),
          brandColumn('Nike', ['Dunk', 'TN']),
          // By number, the option's ranks being tied, and only the sizes a tenis offers.
          {
            name: 'Talla',
            display: 'chips',
            links: [list('9', [['option.Talla', '9']]), list('10', [['option.Talla', '10']])],
            viewAll: null,
            note: 'Te mostramos solo lo que hay en tu talla.',
          },
        ],
        footer: [list('Ver todas las marcas')],
      },
    ])

    // Changing the Type moves the product out of Tenis, and out of its brand's column.
    await service.update.product(api.container, dunk.id, { typeId: botas.id })
    const [entry] = await navigation()
    expect(entry?.sections[2]).toEqual(brandColumn('Nike', ['TN']))
  })
})

async function applyStructure(text: string) {
  const upload = await api.request
    .post('/admin/uploads')
    .field('access', 'private')
    .attach('files', Buffer.from(text), { filename: 'estructura.yaml', contentType: 'application/yaml' })
  const [file] = (upload.body as typeof uploadRoutes.PostOutput._zod.output).files
  const applied = await api.post<typeof structureRoutes.PostOutput>('/admin/catalog-structure', { fileId: file?.id })
  if (applied.status !== 200) throw new Error(`The structure was not applied: ${JSON.stringify(applied.body)}`)
}
