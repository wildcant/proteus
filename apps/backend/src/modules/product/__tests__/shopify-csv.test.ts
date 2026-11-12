import type { ImportedProductDTO, ProductImportSettingsDTO } from '@core/types/product/common.js'
import { test } from '@tests/setup/test-extend.js'
import { chunkImportedProducts } from '../utils/shopify-csv/chunk-products.js'
import { parseShopifyCsv } from '../utils/shopify-csv/parse-shopify-csv.js'

const settings: ProductImportSettingsDTO = {
  overwrite: false,
  publish: true,
  defaultCurrency: 'usd',
  marketCurrencies: { colombia: 'cop' },
}

const HEADER =
  'Title,URL handle,Description,Vendor,Type,Tags,Status,SKU,Option1 name,Option1 value,Option2 name,Option2 value,Price,Price / Colombia,Inventory tracker,Inventory quantity,Continue selling when out of stock,Weight value (grams),Product image URL,Image position,Variant image URL'

/** A source that hands the parser the file in small pieces, the way a download stream does. */
async function* streamOf(text: string, pieceSize = 7): AsyncGenerator<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  for (let offset = 0; offset < bytes.length; offset += pieceSize) yield bytes.slice(offset, offset + pieceSize)
}

const parse = (
  lines: string[],
  overrides: Partial<ProductImportSettingsDTO> = {},
  definedMetafieldKeys: string[] = [],
) => parseShopifyCsv(streamOf(`${lines.join('\n')}\n`), { ...settings, ...overrides }, new Set(definedMetafieldKeys))

test.describe('parseShopifyCsv', () => {
  test('groups rows by handle into products with their variants, prices, tags and gallery', async ({ expect }) => {
    const { products, errors, ignoredColumns } = await parse([
      HEADER,
      'Hoodie,hoodie,"<p>Warm,\nsoft</p>", Nike ,Hoodie,"genero:hombre, coleccion:essentials, cotton, , cotton",Active,HOODIE-S-GREEN,Color,Green,Size,S,90,360000,shopify,100,DENY,400,https://cdn.example.com/b.jpg,2,https://cdn.example.com/a.jpg',
      ',hoodie,,,,,,HOODIE-M-GREEN,,Green,,M,"90,50",,shopify,5,CONTINUE,400,https://cdn.example.com/a.jpg,1,',
      ',hoodie,,,,,,,,,,,,,,,,,https://cdn.example.com/c.jpg,3,',
      'Cap,cap,,,,,draft,CAP-1,Title,Default Title,,,10,,,,,,,,',
    ])

    expect(errors).toEqual([])
    expect(ignoredColumns).toEqual([])
    expect(products).toHaveLength(2)
    const [hoodie, cap] = products
    expect(hoodie).toMatchObject({
      line: 2,
      rows: 3,
      handle: 'hoodie',
      title: 'Hoodie',
      description: '<p>Warm,\nsoft</p>',
      status: 'published',
      type: 'Hoodie',
      // Vendor is the brand, trimmed.
      brand: 'Nike',
      // Prefixed tags are plain tags, kept as written; blanks and repeats are dropped.
      tags: ['genero:hombre', 'coleccion:essentials', 'cotton'],
      options: [
        { title: 'Color', values: ['Green'] },
        { title: 'Size', values: ['S', 'M'] },
      ],
      imageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg', 'https://cdn.example.com/c.jpg'],
    })
    // The description spans two lines, so the second variant is on line 4, not 3.
    expect(hoodie?.variants).toEqual([
      {
        line: 2,
        sku: 'HOODIE-S-GREEN',
        optionValues: ['Green', 'S'],
        weight: 400,
        manageInventory: true,
        allowBackorder: false,
        inventoryQuantity: 100,
        prices: [
          { currencyCode: 'usd', amount: 90 },
          { currencyCode: 'cop', amount: 360000 },
        ],
        imageUrl: 'https://cdn.example.com/a.jpg',
      },
      expect.objectContaining({
        line: 4,
        optionValues: ['Green', 'M'],
        allowBackorder: true,
        prices: [{ currencyCode: 'usd', amount: 90.5 }],
      }),
    ])
    expect(cap).toMatchObject({
      line: 6,
      status: 'draft',
      // An empty Vendor cell leaves the product without a brand.
      brand: null,
      options: [],
      variants: [expect.objectContaining({ sku: 'CAP-1', optionValues: [] })],
    })
  })

  test('collects every error with the line it is on, and keeps reading past each one', async ({ expect }) => {
    const { errors } = await parse([
      HEADER,
      'Hoodie,hoodie,,,,,active,H-1,Size,S,,,abc,,,,,,,,',
      ',hoodie,,,,,,H-2,,S,,,10,,,,,,,,',
      'Mug,,,,,,,,,,,,,,,,,,,,',
      'Cap,cap,,,,,,C-1,,,,,10,,,,,,apps/backend/seed-images/cap.jpg,1,',
    ])

    expect(errors).toEqual([
      { line: 2, handle: 'hoodie', message: 'The price "abc" is not a number.' },
      { line: 3, handle: 'hoodie', message: 'The option combination "S" appears more than once.' },
      { line: 4, handle: null, message: 'The row has no URL handle.' },
      { line: 5, handle: 'cap', message: 'The image URL "apps/backend/seed-images/cap.jpg" is not an http(s) URL.' },
    ])
  })

  test('refuses a file missing a required column or naming an unknown market, at the header', async ({ expect }) => {
    const missing = await parse(['Title,SKU', 'Hoodie,H-1'])
    const unknownMarket = await parse(['Title,URL handle,Price / Atlantis', 'Hoodie,hoodie,10'])

    expect(missing).toEqual({
      products: [],
      errors: [{ line: 1, handle: null, message: 'The file is missing the "URL handle" column.' }],
      ignoredColumns: [],
      metafieldKeys: [],
    })
    expect(unknownMarket.errors).toEqual([
      { line: 1, handle: null, message: 'The column "Price / Atlantis" names a market the store does not sell in.' },
    ])
  })

  test('reads custom metafield columns one value per line, ignores Shopify’s own, and refuses an undefined key', async ({
    expect,
  }) => {
    const header =
      'Title,URL handle,Tags,Género (product.metafields.custom.genero),Tipo (product.metafields.custom.tipo),Color (product.metafields.shopify.color-pattern)'
    const { products, errors, ignoredColumns, metafieldKeys } = await parse(
      [
        header,
        // A list cell is one value per line; a comma is part of the value, blanks and repeats drop.
        'Sweatpants,sweatpants,cotton,"men\nunisex\n\nmen","bottoms, lounge",gray',
        // Only the first row of a product is read.
        ',sweatpants,,women,tops,',
        // An empty cell is an empty list: on overwrite it clears the metafield.
        'Cap,cap,,,accessories,',
      ],
      {},
      ['genero', 'tipo'],
    )

    expect(errors).toEqual([])
    expect(metafieldKeys).toEqual(['genero', 'tipo'])
    expect(ignoredColumns).toEqual(['Color (product.metafields.shopify.color-pattern)'])
    expect(products.map((product) => [product.handle, product.metafields])).toEqual([
      ['sweatpants', { genero: ['men', 'unisex'], tipo: ['bottoms, lounge'] }],
      ['cap', { genero: [], tipo: ['accessories'] }],
    ])
    // Tags stay free words beside the metafields.
    expect(products[0]?.tags).toEqual(['cotton'])

    const undefinedKey = await parse([header, 'Cap,cap,,men,accessories,'], {}, ['tipo'])
    expect(undefinedKey.errors).toEqual([
      {
        line: 1,
        handle: null,
        message:
          'The column "Género (product.metafields.custom.genero)" is the metafield "genero", which the store does not define. Declare the campo "genero" in the structure file first.',
      },
    ])
  })

  test('reads a semicolon-delimited file with a byte order mark and mixed-case headers', async ({ expect }) => {
    const { products, errors } = await parseShopifyCsv(
      streamOf('﻿TITLE;Url Handle;Price\nHoodie;hoodie;9,99\n', 3),
      settings,
      new Set(),
    )

    expect(errors).toEqual([])
    expect(products).toEqual([
      expect.objectContaining({
        handle: 'hoodie',
        variants: [expect.objectContaining({ prices: [{ currencyCode: 'usd', amount: 9.99 }] })],
      }),
    ])
  })

  test('drafts active products when publishing is off', async ({ expect }) => {
    const { products } = await parse([HEADER, 'Hoodie,hoodie,,,,,active,H-1,,,,,10,,,,,,,,'], { publish: false })

    expect(products[0]?.status).toBe('draft')
  })

  test('refuses a file over the size cap', async ({ expect }) => {
    const row = 'Hoodie,hoodie,,,,,active,H-1,,,,,10,,,,,,,,\n'
    const text = `${HEADER}\n${row.repeat(Math.ceil((15 * 1024 * 1024) / row.length) + 1)}`

    const { products, errors } = await parseShopifyCsv(streamOf(text, 64 * 1024), settings, new Set())

    expect(products).toEqual([])
    expect(errors).toEqual([{ line: 1, handle: null, message: 'The file is larger than 15 MB.' }])
  })
})

test.describe('chunkImportedProducts', () => {
  const product = (handle: string, rows: number) => ({ handle, rows }) as ImportedProductDTO

  test('cuts chunks only between products', ({ expect }) => {
    const chunks = chunkImportedProducts([product('a', 3), product('b', 3), product('c', 5), product('d', 1)], 6)

    expect(chunks.map((chunk) => chunk.map((entry) => entry.handle))).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})
