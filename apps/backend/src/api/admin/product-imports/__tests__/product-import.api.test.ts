import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { PermissionGrant } from '@core/types/access-control/common.js'
import type { UserDTO } from '@core/types/user/common.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import { sql } from 'drizzle-orm'
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
    definitions: [...productImportDefinitions, ...uploadDefinitions, ...productDefinitions],
    namespaceAuth: true,
  })
  operator = await service.create.operator(api.container, IMPORT_FEATURES)
  headers = authHeader('user', operator.id)

  const store = await factories.create.store()
  await factories.create.storeCurrency({ storeId: store.id, currencyCode: 'usd', isDefault: true })
  await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
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
      `Hoodie,hoodie,<p>Warm</p>,Proteus,Hoodie,"categoria:mens-sweatshirts, coleccion:essentials, cotton",active,HOODIE-S,Size,S,90,360000,shopify,100,${imageBaseUrl}/hoodie.png,1,${imageBaseUrl}/hoodie.png`,
      ',hoodie,,,,,,HOODIE-M,,M,95,380000,shopify,5,,,',
      `Broken,broken,,,,,active,BROKEN-1,,,10,,,,${imageBaseUrl}/missing.png,1,`,
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
        willCreate: {
          categories: ['mens-sweatshirts'],
          collections: ['essentials'],
          tags: ['cotton'],
          types: ['Hoodie'],
        },
        ignoredColumns: ['Vendor'],
        firstProduct: { handle: 'hoodie', title: 'Hoodie', options: [{ title: 'Size', values: ['S', 'M'] }] },
      },
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
    expect(hoodie).toMatchObject({ title: 'Hoodie', description: '<p>Warm</p>', status: 'published' })

    const detail = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${hoodie.id}`, undefined, {
      headers,
    })
    expect(detail.body.product.type?.value).toBe('Hoodie')
    expect(detail.body.product.categories).toEqual([
      expect.objectContaining({
        handle: 'mens-sweatshirts',
        name: 'Mens sweatshirts',
        parentId: null,
        isActive: false,
      }),
    ])
    expect(detail.body.product.collections).toEqual([expect.objectContaining({ handle: 'essentials' })])
    expect(detail.body.product.tags).toEqual([expect.objectContaining({ value: 'cotton' })])

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
