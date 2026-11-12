import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import storeNavigationDefinitions from '../../../store/navigation/definitions.js'
import type * as storeNavigationRoutes from '../../../store/navigation/route.js'
import collectionDefinitions from '../../collections/definitions.js'
import type * as collectionRoutes from '../../collections/route.js'
import productCategoryDefinitions from '../../product-categories/definitions.js'
import type * as categoryRoutes from '../../product-categories/route.js'
import type * as productByIdRoutes from '../../products/[id]/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import uploadDefinitions from '../../uploads/definitions.js'
import type * as uploadRoutes from '../../uploads/route.js'
import catalogStructureDefinitions from '../definitions.js'
import type * as structureRoutes from '../route.js'

/** The development catalogue's structure: four metafield campos and the brand, Men, Women and Unisex with their children and Shoes, three Collections, and a menu whose Men, Women and Shoes open panels. */
const FIXTURE = readFileSync(resolve(__dirname, '../../../../../scripts/seed/catalog-structure.yaml'), 'utf8')

type Plan = (typeof structureRoutes.PostOutput)['_zod']['output']['catalogStructure']

let api: TestApi

test.beforeEach(async ({ createApi, factories }) => {
  api = await createApi({
    definitions: [
      ...catalogStructureDefinitions,
      ...uploadDefinitions,
      ...productDefinitions,
      ...productCategoryDefinitions,
      ...collectionDefinitions,
      ...storeNavigationDefinitions,
    ],
  })
  // The store menu is read for a market, so the store needs a default one.
  const region = await factories.create.region({ name: 'United States', currencyCode: 'usd' })
  await factories.create.store({ defaultRegionId: region.id })
})

/** Uploads the file the way the admin does — private, through the multipart fallback. */
async function upload(text: string): Promise<string> {
  const response = await api.request
    .post('/admin/uploads')
    .field('access', 'private')
    .attach('files', Buffer.from(text), { filename: 'estructura.yaml', contentType: 'application/yaml' })
  const [file] = (response.body as typeof uploadRoutes.PostOutput._zod.output).files
  if (!file) throw new Error(`Upload failed: ${JSON.stringify(response.body)}`)
  return file.id
}

const preview = (fileId: string) =>
  api.post<typeof structureRoutes.PostOutput>('/admin/catalog-structure/preview', { fileId })
const apply = (fileId: string) => api.post<typeof structureRoutes.PostOutput>('/admin/catalog-structure', { fileId })
const navigation = async () =>
  (await api.get<typeof storeNavigationRoutes.GetOutput>('/store/navigation')).body.navigation
const handles = (rows: { handle: string }[]) => rows.map((row) => row.handle).sort()

test.describe('Structure files', () => {
  test('preview shows what the file changes; applying makes the groupings and menu the file’s and is idempotent', async ({
    expect,
    http,
    service,
  }) => {
    // What the catalogue holds before: `genero` under another name and a metafield the file drops, a
    // men's category under another name and inactive, a manual tree the file does not know,
    // `men-tops` filed under that tree, and a collection the file drops.
    const createCategory = async (body: Parameters<typeof http.admin.createProductCategory>[0]) => {
      const response = await api.post<typeof categoryRoutes.PostOutput>(
        '/admin/product-categories',
        http.admin.createProductCategory(body),
      )
      expect(response.status).toBe(201)
      return response.body.productCategory
    }
    const men = await createCategory({ name: 'Caballeros', handle: 'men', isActive: false })
    const legacy = await createCategory({ handle: 'legacy' })
    const legacyChild = await createCategory({ handle: 'legacy-child', parentId: legacy.id })
    const menTops = await createCategory({ name: 'Tops', handle: 'men-tops', parentId: legacy.id })
    const dropped = await api.post<typeof collectionRoutes.PostOutput>(
      '/admin/collections',
      http.admin.createProductCollection({ handle: 'dropped' }),
    )
    expect(dropped.status).toBe(201)

    await service.create.metafieldDefinitions(api.container, [
      { key: 'genero', name: 'Gender' },
      { key: 'temporada', name: 'Temporada' },
    ])
    const { product } = await service.create.product(api.container, {
      title: 'Crew Tee',
      metafields: { genero: ['men'], temporada: ['verano'] },
    })

    const fileId = await upload(FIXTURE)
    const previewed = await preview(fileId)
    expect(previewed.status).toBe(200)
    const plan: Plan = previewed.body.catalogStructure
    expect(plan.errors).toEqual([])
    expect(plan.metafields).toEqual({
      create: [
        { key: 'tipo', name: 'Tipo', filterable: true, source: 'metafield' },
        { key: 'colecciones', name: 'Colecciones', filterable: false, source: 'metafield' },
        { key: 'marca', name: 'Marca', filterable: true, source: 'vendor' },
        { key: 'modelo', name: 'Modelo', filterable: false, source: 'metafield' },
      ],
      update: [{ key: 'genero', name: 'Género', filterable: true, source: 'metafield' }],
      delete: [{ key: 'temporada', name: 'Temporada', filterable: false, source: 'metafield' }],
    })
    expect(handles(plan.categories.create)).toEqual(
      [
        'men-bottoms',
        'men-shoes',
        'women',
        'women-tops',
        'women-bottoms',
        'unisex',
        'unisex-tops',
        'unisex-bottoms',
        'unisex-shoes',
        'unisex-accessories',
        'shoes',
      ].sort(),
    )
    expect(plan.categories.update).toEqual([{ handle: 'men', name: 'Men', parentHandle: null }])
    expect(plan.categories.move).toEqual([
      { handle: 'men-tops', name: 'Tops', parentHandle: 'men', previousParentHandle: 'legacy' },
    ])
    expect(handles(plan.categories.delete)).toEqual(['legacy', 'legacy-child'])
    expect(handles(plan.collections.create)).toEqual(['active', 'essentials', 'featured'])
    expect(plan.collections.delete).toEqual([{ handle: 'dropped', name: dropped.body.collection.title }])
    const subcategories = { type: 'subcategories', name: 'Category' }
    const size = { type: 'option', name: 'Size', option: 'Size', note: 'Only what comes in your size.' }
    expect(plan.menu).toEqual({
      current: [],
      next: [
        { type: 'category', handle: 'men', sections: [subcategories, size] },
        { type: 'category', handle: 'women', sections: [subcategories, size] },
        {
          type: 'category',
          handle: 'shoes',
          sections: [
            {
              type: 'links',
              name: 'All shoes',
              links: [
                { type: 'category', handle: 'men-shoes', name: "Men's shoes" },
                { type: 'category', handle: 'unisex-shoes', name: 'Unisex shoes' },
                { type: 'collection', handle: 'active', name: null },
              ],
            },
            { type: 'groups', name: 'Brands', key: 'modelo', groupKey: 'marca', groups: 6, limit: 6 },
          ],
          footer: [{ type: 'category', handle: 'shoes', name: 'All brands' }],
        },
        { type: 'category', handle: 'unisex', sections: [] },
        { type: 'collection', handle: 'featured', sections: [] },
      ],
    })

    // Preview wrote nothing.
    expect(await navigation()).toEqual([])
    expect((await api.get(`/admin/product-categories/${legacy.id}`)).status).toBe(200)

    const applied = await apply(fileId)
    expect(applied.status).toBe(200)
    expect(applied.body.catalogStructure).toEqual(plan)

    // The tree is the file's, in file order, every Category active; the manual tree is gone.
    const tree = (await api.get<typeof categoryRoutes.GetOutput>('/admin/product-categories')).body.productCategories
    expect(tree.map((root) => root.handle)).toEqual(['men', 'women', 'unisex', 'shoes'])
    const [menNode] = tree
    expect(menNode).toMatchObject({ id: men.id, name: 'Men', isActive: true, rule: { genero: ['men'] } })
    expect(menNode?.children.map((child) => child.handle)).toEqual(['men-tops', 'men-bottoms', 'men-shoes'])
    expect(menNode?.children[0]?.id).toBe(menTops.id)
    for (const gone of [legacy, legacyChild]) {
      const response = await api.get<ApiErrorBody>(`/admin/product-categories/${gone.id}`)
      expect(response.status).toBe(404)
    }
    const collections = (await api.get<typeof collectionRoutes.GetOutput>('/admin/collections')).body.collections
    expect(handles(collections)).toEqual(['active', 'essentials', 'featured'])

    // The re-match picked the product up: Men by the género it already had. The dropped metafield
    // went with its definition, and `genero` reads under the file's name.
    const membersOf = async (filter: string) =>
      (await api.get<typeof productRoutes.GetOutput>(`/admin/products?${filter}`)).body.products.map(
        (member) => member.id,
      )
    expect(await membersOf(`categoryId=${men.id}`)).toEqual([product.id])
    expect(await membersOf(`categoryId=${menTops.id}`)).toEqual([])
    const detail = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${product.id}`)
    expect(detail.body.product.metafields).toEqual([{ key: 'genero', name: 'Género', values: ['men'] }])

    // The metafields the file defines are the ones rules read: Men › Tops by tipo, Featured by colecciones.
    await service.update.productMetafields(api.container, product.id, {
      tipo: ['tops'],
      colecciones: ['featured'],
    })
    expect(await membersOf(`categoryId=${menTops.id}`)).toEqual([product.id])
    const featuredCollection = collections.find((collection) => collection.handle === 'featured')
    expect(await membersOf(`collectionId=${featuredCollection?.id}`)).toEqual([product.id])
    const womenId = tree[1]?.id
    expect(await membersOf(`categoryId=${womenId}`)).toEqual([])

    // The store serves the file's menu, in its order; how sections resolve is the navigation API's own test.
    expect((await navigation()).map(({ type, handle }) => `${type}:${handle}`)).toEqual(
      plan.menu.next.map(({ type, handle }) => `${type}:${handle}`),
    )

    // The same file again changes nothing.
    const again = await preview(await upload(FIXTURE))
    expect(again.body.catalogStructure).toEqual({
      errors: [],
      metafields: { create: [], update: [], delete: [] },
      categories: { create: [], update: [], move: [], delete: [] },
      collections: { create: [], update: [], delete: [] },
      menu: { current: plan.menu.next, next: plan.menu.next },
    })
  })

  test('a file with errors previews them by path and is refused on apply', async ({ expect }) => {
    const fileId = await upload(
      ['categorias:', '  - nombre: Men', '    handle: Men', 'menu:', '  - coleccion: x', ''].join('\n'),
    )

    const previewed = await preview(fileId)
    expect(previewed.status).toBe(200)
    expect(previewed.body.catalogStructure.errors).toEqual([
      {
        path: 'categorias[0].handle',
        message: 'Must be lowercase letters and digits joined by hyphens, like "hombre-clasicos".',
      },
    ])
    expect(previewed.body.catalogStructure.categories.create).toEqual([])

    const applied = await api.post<ApiErrorBody>('/admin/catalog-structure', { fileId })
    expect(applied.status).toBe(400)
    expect(applied.body.type).toBe(ErrorTypes.INVALID_DATA)
    expect(await navigation()).toEqual([])
  })

  test('when the groupings fail to apply, the menu is put back', async ({ expect }) => {
    const productService = api.container.resolve(Modules.PRODUCT)
    vi.spyOn(productService, 'applyCatalogStructure').mockRejectedValue(new Error('groupings failed'))

    const applied = await api.post<ApiErrorBody>('/admin/catalog-structure', { fileId: await upload(FIXTURE) })
    expect(applied.status).toBe(500)
    expect(await navigation()).toEqual([])
  })
})
