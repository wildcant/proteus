import { access, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { SEED_IMAGE_DIR, seedImageFile } from './seed-images.js'

/**
 * Builds `product-import.csv`, a Shopify product CSV, from the mock.shop demo store catalogue.
 *
 *   pnpm --filter backend exec tsx scripts/seed/build-product-import-csv.ts
 *
 * It also downloads every photo the CSV names into `seed-images/`, and deletes the ones it no longer
 * names. Both outputs are committed, so seeding never reaches the network; rerun this only to change
 * the catalogue. Tags are the readable vocabulary `catalog-structure.yaml` writes its rules in:
 * `genero:` and `tipo:` come from mock.shop's own collections, `coleccion:featured` too, and the
 * rest — the Essentials and Active collections, materials, the product type — from `ENRICHMENT`.
 */

const MOCK_SHOP_API = 'https://demostore.mock.shop/api'

/** The originals are 4096px; the Shopify CDN resizes on `?width=`, which keeps the committed set small. */
const SEED_IMAGE_WIDTH = 1200
const OUTPUT_PATH = path.join(import.meta.dirname, 'product-import.csv')

/** mock.shop prices in USD; the Colombia market price is a flat conversion, kept whole. */
const COP_PER_USD = 4000

const QUERY = `{
  products(first: 100) {
    pageInfo { hasNextPage }
    nodes {
      handle title descriptionHtml vendor tags
      collections(first: 20) { nodes { handle } }
      options { name }
      images(first: 50) { nodes { url altText } }
      variants(first: 100) {
        nodes {
          sku quantityAvailable requiresShipping
          price { amount }
          compareAtPrice { amount }
          selectedOptions { name value }
          image { url }
        }
      }
    }
  }
}`

type MockShopProduct = {
  handle: string
  title: string
  descriptionHtml: string
  vendor: string
  tags: string[]
  collections: { nodes: Array<{ handle: string }> }
  options: Array<{ name: string }>
  images: { nodes: Array<{ url: string; altText: string | null }> }
  variants: {
    nodes: Array<{
      sku: string | null
      quantityAvailable: number | null
      requiresShipping: boolean
      price: { amount: string }
      compareAtPrice: { amount: string } | null
      selectedOptions: Array<{ name: string; value: string }>
      image: { url: string } | null
    }>
  }
}

type CatalogResponse = {
  data: { products: { pageInfo: { hasNextPage: boolean }; nodes: MockShopProduct[] } }
}

const GENDERS = ['men', 'women', 'unisex']
const KINDS = ['tops', 'bottoms', 'shoes', 'accessories']
const MOCK_SHOP_COLLECTIONS = ['featured']

type Enrichment = {
  type: string
  /** Collections beyond mock.shop's own `featured`. */
  collections?: Array<'essentials' | 'active'>
  materials?: Array<'cotton' | 'organic-cotton' | 'leather' | 'canvas' | 'nylon'>
}

/**
 * What mock.shop does not say, keyed by its handle. The development seed's hand-written catalogue
 * carried these types, collections and material tags; products it never had get a type from their
 * title and a material only where the description names one of the seed's materials.
 */
const ENRICHMENT: Record<string, Enrichment> = {
  'hoodie-old': { type: 'Hoodie', collections: ['essentials', 'active'], materials: ['cotton'] },
  'men-t-shirt': { type: 'T-shirt', collections: ['essentials'], materials: ['organic-cotton'] },
  'women-t-shirt': { type: 'T-shirt', collections: ['essentials'], materials: ['organic-cotton'] },
  'men-crewneck': { type: 'Crewneck', collections: ['essentials'], materials: ['cotton'] },
  'women-crewneck': { type: 'Crewneck', collections: ['essentials'], materials: ['cotton'] },
  sweatpants: { type: 'Sweatpants', collections: ['essentials'] },
  shorts: { type: 'Shorts', collections: ['active'], materials: ['nylon'] },
  'workout-shirt': { type: 'T-shirt', collections: ['active'], materials: ['nylon'] },
  leggings: { type: 'Leggings', collections: ['active'] },
  'gray-runners': { type: 'Running Shoes', collections: ['active'] },
  'high-top-sneakers': { type: 'Sneakers' },
  'white-leather-sneakers': { type: 'Sneakers', materials: ['leather'] },
  'gray-leather-sneakers': { type: 'Sneakers', materials: ['leather'] },
  'canvas-sneakers': { type: 'Sneakers', materials: ['canvas'] },
  hoodie: { type: 'Hoodie', materials: ['cotton'] },
  'soft-cotton-hoodie-in-jam': { type: 'Hoodie', materials: ['cotton'] },
  'soft-cotton-hoodie-in-clay': { type: 'Hoodie', materials: ['cotton'] },
  'soft-cotton-hoodie-in-ocean': { type: 'Hoodie', materials: ['cotton'] },
  'soft-cotton-hoodie-in-violet': { type: 'Hoodie', materials: ['cotton'] },
  'soft-cotton-hoodie-in-green': { type: 'Hoodie', materials: ['cotton'] },
  'half-zip': { type: 'Sweatshirt' },
  'light-puffer': { type: 'Jacket', materials: ['nylon'] },
  puffer: { type: 'Jacket', materials: ['nylon'] },
  'puffer-jacket': { type: 'Jacket', materials: ['nylon'] },
  'black-sunnies': { type: 'Sunglasses' },
  'clear-sunnies': { type: 'Sunglasses' },
  beanie: { type: 'Hat' },
  slides: { type: 'Sandals' },
  frontpack: { type: 'Bag' },
}

/**
 * One variant sold out and one at or below the store's low-stock threshold, so the storefront's
 * sold-out option, the shopper's "only N left" line and the shopkeeper's alert are all reachable on
 * a fresh database.
 */
const STOCK_BY_SKU: Record<string, number> = {
  'MENTSHIRT-XLARGE-GREEN': 0,
  'MENTSHIRT-MEDIUM-OCEAN': 3,
}

const HEADER = [
  'Title',
  'URL handle',
  'Description',
  'Vendor',
  'Product category',
  'Type',
  'Tags',
  'Published on online store',
  'Status',
  'SKU',
  'Option1 name',
  'Option1 value',
  'Option2 name',
  'Option2 value',
  'Price',
  'Price / Colombia',
  'Compare-at price',
  'Charge tax',
  'Inventory tracker',
  'Inventory quantity',
  'Continue selling when out of stock',
  'Weight value (grams)',
  'Weight unit for display',
  'Requires shipping',
  'Fulfillment service',
  'Product image URL',
  'Image position',
  'Image alt text',
  'Variant image URL',
  'Gift card',
] as const

type Row = Record<(typeof HEADER)[number], string>

const skuToken = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')
const money = (amount: number) => amount.toFixed(2)

/** mock.shop descriptions are one paragraph of editor HTML; the CSV keeps only its text. */
function plainText(html: string): string {
  return html.replaceAll(/<[^>]*>/g, '').replaceAll('\u00a0', ' ').trim()
}

function tagsFor(product: MockShopProduct, enrichment: Enrichment): string {
  const groupings = new Set([...product.collections.nodes.map(({ handle }) => handle), ...product.tags])
  const pick = (vocabulary: string[]) => vocabulary.filter((handle) => groupings.has(handle)).sort()
  return [
    ...pick(GENDERS).map((handle) => `genero:${handle}`),
    ...pick(KINDS).map((handle) => `tipo:${handle}`),
    ...[...pick(MOCK_SHOP_COLLECTIONS), ...(enrichment.collections ?? [])]
      .sort()
      .map((handle) => `coleccion:${handle}`),
    ...[...(enrichment.materials ?? [])].sort(),
  ].join(', ')
}

function rowsFor(product: MockShopProduct, stockedSkus: Set<string>): Row[] {
  const enrichment = ENRICHMENT[product.handle]
  if (!enrichment) throw new Error(`No ENRICHMENT entry for mock.shop product "${product.handle}"`)
  const options = product.options.map(({ name }) => name)
  if (options.length > 2) throw new Error(`"${product.handle}" has more than two options`)
  const optionNames = options.slice(0, 2)
  const isDefaultVariant = options.length === 1 && options[0] === 'Title'
  const variants = product.variants.nodes
  const images = product.images.nodes

  return Array.from({ length: Math.max(variants.length, images.length) }, (_, index) => {
    const row = Object.fromEntries(HEADER.map((column) => [column, ''])) as Row
    row['URL handle'] = product.handle
    if (index === 0) {
      Object.assign(row, {
        Title: product.title,
        Description: plainText(product.descriptionHtml),
        Vendor: product.vendor,
        Type: enrichment.type,
        Tags: tagsFor(product, enrichment),
        'Published on online store': 'TRUE',
        Status: 'Active',
        'Gift card': 'FALSE',
      })
      optionNames.forEach((name, position) => {
        row[position === 0 ? 'Option1 name' : 'Option2 name'] = name
      })
    }
    const variant = variants[index]
    if (variant) {
      const values = new Map(variant.selectedOptions.map(({ name, value }) => [name, value]))
      optionNames.forEach((name, position) => {
        row[position === 0 ? 'Option1 value' : 'Option2 value'] = values.get(name) ?? ''
      })
      const sku =
        variant.sku ||
        [
          skuToken(product.handle),
          ...(isDefaultVariant ? [] : options.map((name) => skuToken(values.get(name) ?? ''))),
        ].join('-')
      const price = Number(variant.price.amount)
      const stocked = STOCK_BY_SKU[sku]
      if (stocked !== undefined) stockedSkus.add(sku)
      Object.assign(row, {
        SKU: sku,
        Price: money(price),
        'Price / Colombia': money(price * COP_PER_USD),
        'Compare-at price': variant.compareAtPrice ? money(Number(variant.compareAtPrice.amount)) : '',
        'Charge tax': 'TRUE',
        'Inventory tracker': 'shopify',
        'Inventory quantity': String(stocked ?? variant.quantityAvailable ?? 0),
        'Continue selling when out of stock': 'DENY',
        'Requires shipping': variant.requiresShipping ? 'TRUE' : 'FALSE',
        'Fulfillment service': 'manual',
        'Variant image URL': variant.image?.url ?? '',
      })
    }
    const image = images[index]
    if (image) {
      Object.assign(row, {
        'Product image URL': image.url,
        'Image position': String(index + 1),
        'Image alt text': image.altText ?? '',
      })
    }
    return row
  })
}

/** RFC 4180 with CRLF records, as spreadsheet exports write it. */
const csvField = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)
const csvLine = (values: readonly string[]) => `${values.map(csvField).join(',')}\r\n`

const response = await fetch(MOCK_SHOP_API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: QUERY }),
})
if (!response.ok) throw new Error(`mock.shop answered ${response.status}`)
const { data } = (await response.json()) as CatalogResponse
if (data.products.pageInfo.hasNextPage) throw new Error('mock.shop has more than 100 products; paginate')

const products = data.products.nodes
const unknownHandles = Object.keys(ENRICHMENT).filter(
  (handle) => !products.some((product) => product.handle === handle),
)
if (unknownHandles.length > 0)
  throw new Error(`ENRICHMENT names products mock.shop lacks: ${unknownHandles.join(', ')}`)

const stockedSkus = new Set<string>()
const rows = products.flatMap((product) => rowsFor(product, stockedSkus))
const missingSkus = Object.keys(STOCK_BY_SKU).filter((sku) => !stockedSkus.has(sku))
if (missingSkus.length > 0) throw new Error(`STOCK_BY_SKU names SKUs mock.shop lacks: ${missingSkus.join(', ')}`)

await writeFile(
  OUTPUT_PATH,
  [csvLine(HEADER), ...rows.map((row) => csvLine(HEADER.map((column) => row[column])))].join(''),
)
console.info(`Wrote ${products.length} products, ${rows.length} rows to ${path.relative(process.cwd(), OUTPUT_PATH)}`)

const imageUrls = [
  ...new Set(rows.flatMap((row) => [row['Product image URL'], row['Variant image URL']]).filter(Boolean)),
]
const wanted = new Set(imageUrls.map(seedImageFile))
if (wanted.size !== imageUrls.length) throw new Error('Two image URLs map to the same seed image file')

const exists = (file: string) =>
  access(path.join(SEED_IMAGE_DIR, file)).then(
    () => true,
    () => false,
  )
// A file is named by its content hash, so one already on disk is already right.
const missing = (
  await Promise.all(imageUrls.map(async (url) => ((await exists(seedImageFile(url))) ? [] : [url])))
).flat()
await Promise.all(
  missing.map(async (url) => {
    const source = new URL(url)
    source.searchParams.set('width', String(SEED_IMAGE_WIDTH))
    const image = await fetch(source)
    if (!image.ok) throw new Error(`${url} answered ${image.status}`)
    await writeFile(path.join(SEED_IMAGE_DIR, seedImageFile(url)), Buffer.from(await image.arrayBuffer()))
  }),
)
const stale = (await readdir(SEED_IMAGE_DIR)).filter((file) => file !== 'README.md' && !wanted.has(file))
await Promise.all(stale.map((file) => rm(path.join(SEED_IMAGE_DIR, file))))
console.info(`Seed images: ${missing.length} downloaded, ${stale.length} deleted, ${wanted.size} in use`)
