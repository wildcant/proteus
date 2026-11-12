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
    expect(response.body.navigation).toEqual([
      {
        type: 'category',
        handle: 'hombre',
        sections: [
          {
            name: 'Estilos',
            links: [list('category', 'hombre-clasicos', 'Clásicos'), list('category', 'hombre-running', 'Running')],
          },
          // Sorted, each brand once, read off the Category's products alone.
          {
            name: 'Marcas',
            links: [
              list('category', 'hombre', 'Adidas', [['marca', 'Adidas']]),
              list('category', 'hombre', 'Nike', [['marca', 'Nike']]),
            ],
          },
          // Cut at `limite`: Superstar is the third.
          {
            name: 'Modelos',
            links: [
              list('category', 'hombre', 'Cortez', [['modelo', 'Cortez']]),
              list('category', 'hombre', 'Gazelle', [['modelo', 'Gazelle']]),
            ],
          },
          {
            name: 'Destacados',
            links: [
              list('category', 'hombre', 'Superstar Adidas', [
                ['marca', 'Adidas'],
                ['modelo', 'Superstar'],
              ]),
              // Labelled by the Collection's own name, as the file names none.
              list('collection', 'rebajas', 'Rebajas'),
              list('category', 'mujer', 'Para ella'),
            ],
          },
        ],
      },
      // Mujer has no children, so its Estilos is left with no links and is not served.
      {
        type: 'category',
        handle: 'mujer',
        sections: [{ name: 'Marcas', links: [list('category', 'mujer', 'Vans', [['marca', 'Vans']])] }],
      },
      // A Collection's values are its own members'.
      {
        type: 'collection',
        handle: 'rebajas',
        sections: [
          {
            name: 'Modelos',
            links: [
              list('collection', 'rebajas', 'Gazelle', [['modelo', 'Gazelle']]),
              list('collection', 'rebajas', 'Old Skool', [['modelo', 'Old Skool']]),
            ],
          },
        ],
      },
      // No secciones: the store shows the Category with its children, as before.
      { type: 'category', handle: 'hombre-clasicos', sections: [] },
    ])
  })
})
