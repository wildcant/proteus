import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { PermissionGrant } from '@core/types/access-control/common.js'
import type { UserDTO } from '@core/types/user/common.js'
import type { AdminCreateProductCategoryBody } from '@proteus/http-schemas/admin'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import { sql } from 'drizzle-orm'
import storeProductDefinitions from '../../../store/products/definitions.js'
import type * as storeProductRoutes from '../../../store/products/route.js'
import productCategoryDefinitions from '../../product-categories/definitions.js'
import type * as categoryRoutes from '../../product-categories/route.js'
import type * as productByIdRoutes from '../../products/[id]/route.js'
import productDefinitions from '../../products/definitions.js'
import uploadDefinitions from '../../uploads/definitions.js'
import type * as uploadRoutes from '../../uploads/route.js'
import type * as importByIdRoutes from '../[id]/route.js'
import productImportDefinitions from '../definitions.js'
import type * as importRoutes from '../route.js'

const HEADER =
  'Title,URL handle,Description,Vendor,Type,Tags,Status,SKU,Option1 name,Option1 value,Price,Price / Colombia,Inventory tracker,Inventory quantity,Product image URL,Image position,Variant image URL'

/** A small PNG host, standing in for wherever the merchant's catalogue keeps its photos. */
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')

let api: TestApi
let operator: UserDTO
let headers: Record<string, string>
let imageHost: Server
let imageBaseUrl: string

const IMPORT_FEATURES: PermissionGrant[] = [
  'product.create',
  'product.update',
  'product.read',
  'file.create',
  'file.read',
]

test.beforeEach(async ({ createApi, factories, service }) => {
  api = await createApi({
    definitions: [
      ...productImportDefinitions,
      ...uploadDefinitions,
      ...productDefinitions,
      ...productCategoryDefinitions,
      ...storeProductDefinitions,
    ],
    namespaceAuth: true,
  })
  operator = await service.create.operator(api.container, IMPORT_FEATURES)
  headers = authHeader('user', operator.id)

  // Colombia is the storefront's market, so a product the import prices in pesos is listed there.
  const colombia = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
  const store = await factories.create.store({ defaultRegionId: colombia.id })
  await factories.create.storeCurrency({ storeId: store.id, currencyCode: 'usd', isDefault: true })
  await service.create.stockLocation(api.container)

  imageHost = createServer((request, response) => {
    if (request.url === '/hoodie.png') {
      response.writeHead(200, { 'content-type': 'image/png' }).end(PNG)
      return
    }
    response.writeHead(404).end()
  })
  await new Promise<void>((resolve) => imageHost.listen(0, '127.0.0.1', resolve))
  imageBaseUrl = `http://127.0.0.1:${(imageHost.address() as AddressInfo).port}`
})

test.afterEach(async () => {
  await new Promise((resolve) => imageHost.close(resolve))
})

/** Uploads the CSV the way the admin does — private, through the multipart fallback. */
async function upload(lines: string[], requestHeaders = headers): Promise<string> {
  const response = await api.request
    .post('/admin/uploads')
    .set(requestHeaders)
    .field('access', 'private')
    .attach('files', Buffer.from(`${lines.join('\n')}\n`), { filename: 'products.csv', contentType: 'text/csv' })
  const [file] = (response.body as typeof uploadRoutes.PostOutput._zod.output).files
  if (!file) throw new Error(`Upload failed: ${JSON.stringify(response.body)}`)
  return file.id
}

async function preview(lines: string[], options: { overwrite?: boolean; publish?: boolean } = {}) {
  const fileId = await upload(lines)
  const response = await api.post<typeof importRoutes.PostOutput>(
    '/admin/product-imports',
    { fileId, ...options },
    { headers },
  )
  return { fileId, response }
}

const retrieveImport = (id: string) =>
  api.get<typeof importByIdRoutes.GetOutput>(`/admin/product-imports/${id}`, undefined, { headers })

/** Previews and confirms a file, and returns the job once the run is over. */
async function runImport(lines: string[], options: { overwrite?: boolean } = {}) {
  const { response } = await preview(lines, options)
  const id = response.body.productImport.id
  const confirmed = await api.post(`/admin/product-imports/${id}/confirm`, undefined, { headers })
  if (confirmed.status !== 202) throw new Error(`Confirm failed: ${JSON.stringify(confirmed.body)}`)
  return (await retrieveImport(id)).body.productImport
}

test.describe('product CSV import', () => {
  test('previews a file, then imports it, failing the one product that cannot be imported on its own', async ({
    expect,
    service,
  }) => {
    const lines = [
      HEADER,
      `Hoodie,hoodie,<p>Warm</p>,Proteus,Hoodie,"genero:hombre, cotton",active,HOODIE-S,Size,S,90,360000,shopify,100,${imageBaseUrl}/hoodie.png,1,${imageBaseUrl}/hoodie.png`,
      ',hoodie,,,,,,HOODIE-M,,M,95,380000,shopify,5,,,',
      `Broken,broken,,,,,active,BROKEN-1,,,10,,shopify,3,${imageBaseUrl}/missing.png,1,`,
      'Mug,mug,,,,,active,MUG-1,,,9,,,,,,',
    ]

    const { fileId, response } = await preview(lines)

    expect(response.status).toBe(201)
    expect(response.body.productImport).toMatchObject({
      status: 'previewed',
      options: { overwrite: false, publish: true },
      errors: [],
      summary: {
        products: { create: 3, update: 0, skip: 0 },
        skus: 4,
        images: 2,
        // Vendor is read, as the brand; with no vendor campo declared the store has no name for it.
        ignoredColumns: [],
        brandName: null,
        firstProduct: {
          handle: 'hoodie',
          title: 'Hoodie',
          brand: 'Proteus',
          options: [{ title: 'Size', values: ['S', 'M'] }],
        },
      },
    })
    // A prefixed tag is a tag like any other: the file names no groupings to create.
    expect(response.body.productImport.summary.willCreate).toEqual({
      tags: ['genero:hombre', 'cotton'],
      types: ['Hoodie'],
    })

    const id = response.body.productImport.id
    const confirmed = await api.post(`/admin/product-imports/${id}/confirm`, undefined, { headers })
    const job = (await retrieveImport(id)).body.productImport

    expect(confirmed.status).toBe(202)
    // The product after the failed one still went in: one failure does not stop the run.
    expect(job).toMatchObject({ status: 'completed', created: 2, updated: 0, skipped: 0, failed: 1 })
    expect(job.errors).toEqual([
      { line: 4, handle: 'broken', message: `The image "${imageBaseUrl}/missing.png" could not be downloaded.` },
    ])

    // The failed product unwound itself and only itself.
    expect(await service.read.products(api.container, { handle: 'broken' })).toEqual([])
    expect(await service.read.products(api.container, { handle: 'mug' })).toHaveLength(1)
    const [hoodie] = await service.read.products(api.container, { handle: 'hoodie' })
    if (!hoodie) throw new Error('Expected the hoodie to be imported')
    expect(hoodie).toMatchObject({ title: 'Hoodie', description: '<p>Warm</p>', status: 'published', brand: 'Proteus' })

    const detail = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${hoodie.id}`, undefined, {
      headers,
    })
    expect(detail.body.product.type?.value).toBe('Hoodie')
    // No structure is applied, so the import placed the hoodie in nothing and created no Category.
    expect(detail.body.product.categories).toEqual([])
    expect(detail.body.product.collections).toEqual([])
    expect(detail.body.product.tags.map((tag) => tag.value).sort()).toEqual(['cotton', 'genero:hombre'])
    const categories = await api.get<typeof categoryRoutes.GetOutput>('/admin/product-categories', undefined, {
      headers,
    })
    expect(categories.body.productCategories).toEqual([])

    const variants = await service.read.productVariants(api.container, { productId: hoodie.id })
    expect(variants.map((variant) => variant.sku).sort()).toEqual(['HOODIE-M', 'HOODIE-S'])
    const small = variants.find((variant) => variant.sku === 'HOODIE-S')
    if (!small) throw new Error('Expected HOODIE-S')

    const [priceLink] = await service.read
      .linkRepo(api.container, 'productVariantPriceSet')
      .findByVariantIds([small.id])
    const prices = await service.read.prices(api.container, priceLink?.priceSetId ?? '')
    expect(prices.map((price) => [price.currencyCode, price.amount.toNumber()]).sort()).toEqual([
      ['cop', 360000],
      ['usd', 90],
    ])

    const [inventoryLink] = await service.read
      .linkRepo(api.container, 'productVariantInventoryItem')
      .findByVariantIds([small.id])
    const [level] = await service.read.inventoryLevels(api.container, {
      inventoryItemId: inventoryLink?.inventoryItemId ?? '',
    })
    expect(level?.stockedQuantity).toBe(100)

    // Downloaded into our storage, not hot-linked from the merchant's host.
    const images = await service.read.productImages(api.container, { productId: hoodie.id })
    expect(images).toHaveLength(1)
    expect(images[0]?.url).not.toContain(imageBaseUrl)
    expect(await service.read.productVariantImages(api.container, { variantId: small.id })).toEqual([
      expect.objectContaining({ imageId: images[0]?.id }),
    ])

    const notifications = await service.read.notifications(api.container, { to: operator.email })
    expect(notifications).toEqual([
      expect.objectContaining({
        resourceType: 'product_import',
        resourceId: id,
        data: expect.objectContaining({
          title: 'Product import finished',
          description: '2 created, 0 updated, 0 skipped, 1 failed.',
        }),
      }),
    ])

    // The run cleans up after itself.
    const uploaded = await api.get(`/admin/uploads/${fileId}`, undefined, { headers })
    expect(uploaded.status).toBe(404)

    // The failed product left nothing behind that blocks it, SKU included: fixed, it imports.
    const retried = await runImport([
      HEADER,
      `Broken,broken,,,,,active,BROKEN-1,,,10,,shopify,3,${imageBaseUrl}/hoodie.png,1,`,
    ])
    expect(retried).toMatchObject({ status: 'completed', created: 1, failed: 0, errors: [] })
  })

  test('places imported products in the ruled Categories their metafields match, and moves them on overwrite', async ({
    expect,
    http,
    service,
  }) => {
    // The structure comes first: its campos define the metafields, its rules read them.
    await service.create.metafieldDefinitions(api.container, [
      { key: 'genero', name: 'Género' },
      { key: 'estilo', name: 'Estilo' },
    ])
    const createCategory = async (body: Partial<AdminCreateProductCategoryBody>) => {
      const response = await api.post<typeof categoryRoutes.PostOutput>(
        '/admin/product-categories',
        http.admin.createProductCategory({ isActive: true, ...body }),
        { headers },
      )
      expect(response.status).toBe(201)
      return response.body.productCategory
    }
    const men = await createCategory({ name: 'Hombre', handle: 'hombre', rule: { genero: ['hombre'] } })
    const menClassics = await createCategory({
      name: 'Clásicos',
      handle: 'hombre-clasicos',
      parentId: men.id,
      rule: { genero: ['hombre'], estilo: ['clasicos'] },
    })
    const women = await createCategory({ name: 'Mujer', handle: 'mujer', rule: { genero: ['mujer'] } })

    const generoColumn = 'Género (product.metafields.custom.genero)'
    const estiloColumn = 'Estilo (product.metafields.custom.estilo)'
    const loafer = (columns: Record<string, string>) => [
      `${HEADER},${Object.keys(columns).join(',')}`,
      `Loafer,loafer,,,,leather,active,LOAFER-1,,,90,360000,,,,,,${Object.values(columns)
        .map((cell) => `"${cell}"`)
        .join(',')}`,
    ]
    const listedIn = async (handle: string) => {
      const response = await api.get<typeof storeProductRoutes.GetOutput>(`/store/products?category=${handle}`)
      expect(response.status).toBe(200)
      return response.body.products.map((product) => product.handle)
    }
    const detail = async () => {
      const [product] = await service.read.products(api.container, { handle: 'loafer' })
      const response = await api.get<typeof productByIdRoutes.GetOutput>(
        `/admin/products/${product?.id ?? ''}`,
        undefined,
        { headers },
      )
      return response.body.product
    }
    const placement = async () => (await detail()).categories.map((category) => category.handle).sort()

    // A list cell holds one value per line.
    const created = await runImport(loafer({ [generoColumn]: 'hombre\nunisex', [estiloColumn]: 'clasicos' }))

    expect(created).toMatchObject({
      status: 'completed',
      created: 1,
      failed: 0,
      summary: {
        metafields: [
          { key: 'genero', name: 'Género' },
          { key: 'estilo', name: 'Estilo' },
        ],
      },
    })
    expect(await placement()).toEqual([men.handle, menClassics.handle].sort())
    expect(await listedIn('hombre')).toEqual(['loafer'])
    expect(await listedIn('hombre-clasicos')).toEqual(['loafer'])
    expect(await listedIn(women.handle)).toEqual([])
    // Tags stay free words: the product is not placed by `leather`.
    expect((await detail()).tags.map((tag) => tag.value)).toEqual(['leather'])

    // Overwriting with only the Género column re-classifies it and leaves Estilo as it was.
    const moved = await runImport(loafer({ [generoColumn]: 'mujer' }), { overwrite: true })

    expect(moved).toMatchObject({ status: 'completed', updated: 1, failed: 0 })
    expect(await placement()).toEqual([women.handle])
    expect(await listedIn('hombre')).toEqual([])
    expect(await listedIn(women.handle)).toEqual(['loafer'])
    expect((await detail()).metafields).toEqual([
      { key: 'estilo', name: 'Estilo', values: ['clasicos'] },
      { key: 'genero', name: 'Género', values: ['mujer'] },
    ])

    // An empty cell clears the metafield, taking the product out of the rule that read it.
    await runImport(loafer({ [generoColumn]: '' }), { overwrite: true })
    expect(await placement()).toEqual([])

    // A column for a metafield the structure does not define refuses the file at the header.
    const { response } = await preview(loafer({ 'Talla (product.metafields.custom.talla)': 'm' }))
    expect(response.body.productImport.errors).toEqual([
      {
        line: 1,
        handle: null,
        message:
          'The column "Talla (product.metafields.custom.talla)" is the metafield "talla", which the store does not define. Declare the campo "talla" in the structure file first.',
      },
    ])
  })

  test('reads Vendor as the brand, which the vendor campo rules on and an overwrite replaces', async ({
    expect,
    http,
    service,
  }) => {
    await service.create.metafieldDefinitions(api.container, [{ key: 'marca', name: 'Marca', source: 'vendor' }])
    const created = await api.post<typeof categoryRoutes.PostOutput>(
      '/admin/product-categories',
      http.admin.createProductCategory({ isActive: true, handle: 'nike', rule: { marca: ['Nike'] } }),
      { headers },
    )
    expect(created.status).toBe(201)

    const loafer = (vendor: string, extraColumns = '', extraCells = '') => [
      `${HEADER}${extraColumns}`,
      `Loafer,loafer,,${vendor},,,active,LOAFER-1,,,90,360000,,,,,${extraCells}`,
    ]
    const listedIn = async (handle: string) => {
      const response = await api.get<typeof storeProductRoutes.GetOutput>(`/store/products?category=${handle}`)
      expect(response.status).toBe(200)
      return response.body.products.map((product) => [product.handle, product.brand])
    }

    // The preview names the brand as the store does.
    const { response } = await preview(loafer(' Nike '))
    expect(response.body.productImport.summary).toMatchObject({
      ignoredColumns: [],
      brandName: 'Marca',
      firstProduct: { brand: 'Nike' },
    })

    await runImport(loafer('Nike'))
    expect(await listedIn('nike')).toEqual([['loafer', 'Nike']])

    // An overwrite replaces the brand, and the rule lets the product go.
    const moved = await runImport(loafer('Adidas'), { overwrite: true })
    expect(moved).toMatchObject({ status: 'completed', updated: 1, failed: 0 })
    expect(await listedIn('nike')).toEqual([])
    const [product] = await service.read.products(api.container, { handle: 'loafer' })
    expect(product?.brand).toBe('Adidas')

    // The vendor campo is no metafield: a metafield column for its clave is refused.
    const metafieldColumn = await preview(loafer('Nike', ',Marca (product.metafields.custom.marca)', ',Nike'))
    expect(metafieldColumn.response.body.productImport.errors).toEqual([
      expect.objectContaining({
        line: 1,
        message: expect.stringContaining('"marca", which the store does not define'),
      }),
    ])
  })

  test('skips products whose handle exists, and with overwrite updates them, matching variants by SKU', async ({
    expect,
    service,
  }) => {
    await runImport([HEADER, 'Cap,cap,,,,,active,CAP-1,,,10,,shopify,3,,,'])
    const [cap] = await service.read.products(api.container, { handle: 'cap' })
    const [variant] = await service.read.productVariants(api.container, { productId: cap?.id ?? '' })

    const skipped = await runImport([HEADER, 'Cap renamed,cap,,,,,active,CAP-1,,,12,,shopify,7,,,'])
    const titleAfterSkip = (await service.read.products(api.container, { handle: 'cap' }))[0]?.title

    const updated = await runImport([HEADER, 'Cap renamed,cap,,,,,active,CAP-1,,,12,,shopify,7,,,'], {
      overwrite: true,
    })
    const [afterOverwrite] = await service.read.products(api.container, { handle: 'cap' })
    const variants = await service.read.productVariants(api.container, { productId: cap?.id ?? '' })
    const [priceLink] = await service.read
      .linkRepo(api.container, 'productVariantPriceSet')
      .findByVariantIds([variant?.id ?? ''])
    const prices = await service.read.prices(api.container, priceLink?.priceSetId ?? '')

    expect(skipped).toMatchObject({ status: 'completed', skipped: 1, created: 0, updated: 0 })
    expect(titleAfterSkip).toBe('Cap')
    expect(updated).toMatchObject({ status: 'completed', updated: 1, summary: { products: { update: 1, skip: 0 } } })
    expect(afterOverwrite?.title).toBe('Cap renamed')
    expect(variants.map((entry) => entry.id)).toEqual([variant?.id])
    expect(prices.map((price) => [price.currencyCode, price.amount.toNumber()])).toEqual([['usd', 12]])
  })

  test('refuses to run a file with errors, listing every one with its line', async ({ expect }) => {
    const { response } = await preview([
      HEADER,
      // A quoted description spanning two lines: every line after it is one further down than its record.
      'Hoodie,hoodie,"<p>Warm\nsoft</p>",,,,active,H-1,Size,S,abc,,,,,,',
      ',,,,,,,H-2,,M,10,,,,,,',
      'Cap,cap,,,,,active,C-1,,,10,,,,apps/backend/seed-images/cap.jpg,1,',
    ])
    const id = response.body.productImport.id
    const confirmed = await api.post<ApiErrorBody>(`/admin/product-imports/${id}/confirm`, undefined, { headers })

    expect(response.body.productImport.errors).toEqual([
      { line: 2, handle: 'hoodie', message: 'The price "abc" is not a number.' },
      { line: 4, handle: null, message: 'The row has no URL handle.' },
      { line: 5, handle: 'cap', message: 'The image URL "apps/backend/seed-images/cap.jpg" is not an http(s) URL.' },
    ])
    expect(confirmed.status).toBe(400)
    expect(confirmed.body.type).toBe('not_allowed')
  })

  test('reads a semicolon-delimited file', async ({ expect }) => {
    const job = await runImport(['Title;URL handle;Price', 'Mug;mug;9,50'])

    expect(job).toMatchObject({ status: 'completed', created: 1 })
  })

  test('cancel deletes the uploaded file; an hour-old preview cannot be confirmed', async ({ expect, getDb }) => {
    const canceled = await preview([HEADER, 'Mug,mug,,,,,active,MUG-1,,,9,,,,,,'])
    const cancel = await api.post<typeof importByIdRoutes.GetOutput>(
      `/admin/product-imports/${canceled.response.body.productImport.id}/cancel`,
      undefined,
      { headers },
    )
    const canceledFile = await api.get(`/admin/uploads/${canceled.fileId}`, undefined, { headers })

    const stale = await preview([HEADER, 'Mug,mug,,,,,active,MUG-1,,,9,,,,,,'])
    const staleId = stale.response.body.productImport.id
    await getDb().execute(sql`UPDATE product_import SET created_at = now() - interval '2 hours' WHERE id = ${staleId}`)
    const refused = await api.post<ApiErrorBody>(`/admin/product-imports/${staleId}/confirm`, undefined, { headers })

    expect(cancel.body.productImport.status).toBe('canceled')
    expect(canceledFile.status).toBe(404)
    expect(refused.status).toBe(400)
    expect(refused.body.message).toContain('expired')
  })

  test('overwriting needs permission to edit products', async ({ expect, service }) => {
    const creator = await service.create.operator(api.container, ['product.create', 'file.create'])
    const creatorHeaders = authHeader('user', creator.id)
    const fileId = await upload([HEADER, 'Mug,mug,,,,,active,MUG-1,,,9,,,,,,'], creatorHeaders)

    const overwrite = await api.post('/admin/product-imports', { fileId, overwrite: true }, { headers: creatorHeaders })
    const plain = await api.post('/admin/product-imports', { fileId }, { headers: creatorHeaders })

    expect(overwrite.status).toBe(403)
    expect(plain.status).toBe(201)
  })
})
