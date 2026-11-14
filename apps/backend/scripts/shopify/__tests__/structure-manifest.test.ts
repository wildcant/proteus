import { createReadStream, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from '@tests/setup/test-extend.js'
import { parseCatalogStructure } from '../../../src/modules/product/utils/catalog-structure/parse-catalog-structure.js'
import { parseShopifyCsv } from '../../../src/modules/product/utils/shopify-csv/parse-shopify-csv.js'
import { buildStructureManifest } from '../structure-manifest.js'

const FIXTURE = readFileSync(resolve(__dirname, '../../seed/catalog-structure.yaml'), 'utf8')
const SEED_CSV = resolve(__dirname, '../../seed/product-import.csv')

const parse = (lines: string[]) => {
  const { structure, errors } = parseCatalogStructure(`${lines.join('\n')}\n`)
  if (!structure) throw new Error(`Invalid structure: ${JSON.stringify(errors)}`)
  return structure
}

test.describe('buildStructureManifest', () => {
  test('maps each rule shape to the Shopify condition it can express, or flags it', async ({ expect }) => {
    const manifest = buildStructureManifest(
      parse([
        'fields:',
        '  - { name: Género, key: genero, filterable: true }',
        '  - { name: Estilo, key: estilo }',
        '  - { name: Colección, key: coleccion }',
        'categories:',
        '  - name: Hombre',
        '    handle: hombre',
        '    rule: { genero: [hombre, unisex] }',
        '    children:',
        '      - name: Clásicos',
        '        handle: hombre-clasicos',
        '        rule: { genero: [hombre, unisex], estilo: [clasicos] }',
        '      - name: Ofertas',
        '        handle: hombre-ofertas',
        '  - name: Mujer',
        '    handle: mujer',
        '    rule: { genero: [mujer], estilo: [clasicos] }',
        'collections:',
        '  - name: Staff picks',
        '    handle: staff-picks',
        '    rule: { coleccion: [staff-picks] }',
        'menu:',
        '  - collection: staff-picks',
        '  - category: hombre',
      ]),
    )

    expect(manifest.metafields).toEqual([
      { name: 'Género', namespace: 'custom', key: 'genero', type: 'list.single_line_text_field' },
      { name: 'Estilo', namespace: 'custom', key: 'estilo', type: 'list.single_line_text_field' },
      { name: 'Colección', namespace: 'custom', key: 'coleccion', type: 'list.single_line_text_field' },
    ])
    expect(manifest.collections).toEqual([
      {
        title: 'Hombre',
        handle: 'hombre',
        rule: {
          applies: 'any',
          conditions: [
            { metafield: 'custom.genero', value: 'hombre' },
            { metafield: 'custom.genero', value: 'unisex' },
          ],
        },
      },
      {
        title: 'Hombre › Clásicos',
        handle: 'hombre-clasicos',
        rule: null,
        unsupported:
          'The rule { genero: [hombre, unisex], estilo: [clasicos] } mixes "all" and "any": a Shopify collection matches all of its conditions or any of them, never both. Give each key one value, or make the rule a single key with its alternatives.',
      },
      { title: 'Hombre › Ofertas', handle: 'hombre-ofertas', rule: null },
      {
        title: 'Mujer',
        handle: 'mujer',
        rule: {
          applies: 'all',
          conditions: [
            { metafield: 'custom.genero', value: 'mujer' },
            { metafield: 'custom.estilo', value: 'clasicos' },
          ],
        },
      },
      {
        title: 'Staff picks',
        handle: 'staff-picks',
        rule: { applies: 'all', conditions: [{ metafield: 'custom.coleccion', value: 'staff-picks' }] },
      },
    ])
    expect(manifest.menu).toEqual([
      { title: 'Staff picks', collectionHandle: 'staff-picks', url: null, children: [] },
      {
        title: 'Hombre',
        collectionHandle: 'hombre',
        url: null,
        children: [
          { title: 'Clásicos', collectionHandle: 'hombre-clasicos', url: null, children: [] },
          { title: 'Ofertas', collectionHandle: 'hombre-ofertas', url: null, children: [] },
        ],
      },
    ])
  })

  test('the seed structure maps to Shopify without a flagged rule', async ({ expect }) => {
    const { structure } = parseCatalogStructure(FIXTURE)
    if (!structure) throw new Error('The seed structure no longer parses')
    // The seed is a pair: its menu's Size sections read their sizes off the seed catalogue, as the
    // script reads them when given the CSV.
    const { products } = await parseShopifyCsv(
      createReadStream(SEED_CSV),
      { overwrite: false, publish: false, defaultCurrency: null, marketCurrencies: {} },
      new Set(structure.metafields.map((metafield) => metafield.key)),
    )

    const manifest = buildStructureManifest(structure, products)

    expect(manifest.collections.filter((collection) => collection.unsupported)).toEqual([])
    expect(manifest.collections.find((collection) => collection.handle === 'men-tops')).toEqual({
      title: 'Men › Tops',
      handle: 'men-tops',
      rule: {
        applies: 'all',
        conditions: [
          { metafield: 'custom.genero', value: 'men' },
          { metafield: 'custom.tipo', value: 'tops' },
        ],
      },
    })
    // The brand is the built-in Vendor: a filter, but no definition.
    expect(manifest.metafields.map(({ key }) => key)).toEqual(['genero', 'tipo', 'colecciones', 'modelo'])
    expect(manifest.filters).toEqual([
      { name: 'Género', source: 'metafield', metafield: 'custom.genero' },
      { name: 'Tipo', source: 'metafield', metafield: 'custom.tipo' },
      { name: 'Marca', source: 'vendor' },
    ])
    expect(manifest.collections).toHaveLength(16)
    // A panel's sections are the entry's children, a grouped section one child per brand; an entry with
    // no sections keeps its subcategories.
    expect(manifest.menu.map((item) => [item.title, item.children.map((child) => child.title)])).toEqual([
      ['Men', ['Category', 'Size']],
      ['Women', ['Category', 'Size']],
      ['Shoes', ['All shoes', 'Arco', 'Vela', 'Kinetic', 'All brands']],
      ['Unisex', ['Tops', 'Bottoms', 'Shoes', 'Accessories']],
      ['Featured', []],
    ])
    // A Size section lists the sizes the seed catalogue's products offer.
    expect(manifest.menu[1]?.children[1]?.children.map((child) => child.title)).toEqual([
      'Large',
      'Medium',
      'Small',
      'X-Large',
    ])
  })

  test('the vendor field is a Proveedor condition and the Brand filter, and menu sections expand from the CSV products', async ({
    expect,
  }) => {
    const structure = parse([
      'fields:',
      '  - { name: Marca, key: marca, source: vendor, filterable: true }',
      '  - { name: Género, key: genero, filterable: true }',
      '  - { name: Modelo, key: modelo }',
      'categories:',
      '  - name: Hombre',
      '    handle: hombre',
      '    rule: { genero: [hombre] }',
      '    children:',
      '      - name: Clásicos',
      '        handle: hombre-clasicos',
      '        rule: { genero: [hombre], modelo: [Stan Smith] }',
      '        children:',
      '          - { name: Blancos, handle: hombre-clasicos-blancos }',
      '  - name: Nike',
      '    handle: nike',
      '    rule: { marca: [Nike] }',
      'collections:',
      '  - { name: Rebajas, handle: rebajas }',
      'menu:',
      '  - category: hombre',
      '    sections:',
      '      - { name: Estilos, show: subcategories }',
      '      - { name: Marcas, show: { values: marca } }',
      '      - { name: Modelos, show: { values: modelo, limit: 2 } }',
      '      - name: Destacados',
      '        links:',
      '          - { name: Stan Smith Adidas, filter: { marca: [Adidas], modelo: [Stan Smith] } }',
      '          - { collection: rebajas }',
      '  - collection: rebajas',
      '    sections:',
      // A manual Collection's members are picked in the admin: the CSV cannot say which, so no values.
      '      - { name: Marcas, show: { values: marca } }',
      '  - category: nike',
    ])
    const csvProduct = (brand: string, metafields: Record<string, string[]>) => ({
      brand,
      type: null,
      metafields,
      options: [],
    })
    const csvProducts = [
      csvProduct('Adidas', { genero: ['hombre'], modelo: ['Stan Smith'] }),
      // One brand whatever its case, under the spelling met first.
      csvProduct('adidas', { genero: ['hombre'], modelo: ['Gazelle'] }),
      csvProduct('Nike', { genero: ['hombre'], modelo: ['Air Force 1'] }),
      // Not the entry's: its values are not offered under Hombre.
      csvProduct('Vans', { genero: ['mujer'], modelo: ['Old Skool'] }),
    ]

    const manifest = buildStructureManifest(structure, csvProducts)

    expect(manifest.metafields.map(({ key }) => key)).toEqual(['genero', 'modelo'])
    // In field order, the brand first.
    expect(manifest.filters).toEqual([
      { name: 'Marca', source: 'vendor' },
      { name: 'Género', source: 'metafield', metafield: 'custom.genero' },
    ])
    expect(manifest.collections.find((collection) => collection.handle === 'nike')?.rule).toEqual({
      applies: 'all',
      conditions: [{ field: 'vendor', value: 'Nike' }],
    })

    const leaf = (title: string, collectionHandle: string, url: string | null = null) => ({
      title,
      collectionHandle,
      url,
      children: [],
    })
    const section = (title: string, children: ReturnType<typeof leaf>[]) => ({
      title,
      collectionHandle: 'hombre',
      url: null,
      children,
    })
    expect(manifest.menu).toEqual([
      {
        title: 'Hombre',
        collectionHandle: 'hombre',
        url: null,
        children: [
          // The children alone: a grandchild would be a fourth level.
          section('Estilos', [leaf('Clásicos', 'hombre-clasicos')]),
          section('Marcas', [
            leaf('Adidas', 'hombre', '/collections/hombre?filter.p.vendor=Adidas'),
            leaf('Nike', 'hombre', '/collections/hombre?filter.p.vendor=Nike'),
          ]),
          // Sorted and cut at `limit`; values URL-encoded.
          section('Modelos', [
            leaf('Air Force 1', 'hombre', '/collections/hombre?filter.p.m.custom.modelo=Air%20Force%201'),
            leaf('Gazelle', 'hombre', '/collections/hombre?filter.p.m.custom.modelo=Gazelle'),
          ]),
          section('Destacados', [
            leaf(
              'Stan Smith Adidas',
              'hombre',
              '/collections/hombre?filter.p.vendor=Adidas&filter.p.m.custom.modelo=Stan%20Smith',
            ),
            leaf('Rebajas', 'rebajas'),
          ]),
        ],
      },
      // Its only section has no values, so it is left with none.
      { title: 'Rebajas', collectionHandle: 'rebajas', url: null, children: [] },
      // No sections: the Category's tree, as before.
      { title: 'Nike', collectionHandle: 'nike', url: null, children: [] },
    ])

    // Without the CSV a `values` section has nothing to read.
    expect(() => buildStructureManifest(structure)).toThrow(
      'The menu entry "hombre" lists values in "Marcas": pass the product CSV to read them from.',
    )
  })
})
