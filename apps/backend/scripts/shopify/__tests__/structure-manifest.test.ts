import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from '@tests/setup/test-extend.js'
import { parseCatalogStructure } from '../../../src/modules/product/utils/catalog-structure/parse-catalog-structure.js'
import { buildStructureManifest } from '../structure-manifest.js'

const FIXTURE = readFileSync(resolve(__dirname, '../../seed/catalog-structure.yaml'), 'utf8')

const parse = (lines: string[]) => {
  const { structure, errors } = parseCatalogStructure(`${lines.join('\n')}\n`)
  if (!structure) throw new Error(`Invalid structure: ${JSON.stringify(errors)}`)
  return structure
}

test.describe('buildStructureManifest', () => {
  test('maps each rule shape to the Shopify condition it can express, or flags it', async ({ expect }) => {
    const manifest = buildStructureManifest(
      parse([
        'campos:',
        '  - { nombre: Género, clave: genero, filtro: true }',
        '  - { nombre: Estilo, clave: estilo }',
        '  - { nombre: Colección, clave: coleccion }',
        'categorias:',
        '  - nombre: Hombre',
        '    handle: hombre',
        '    regla: { genero: [hombre, unisex] }',
        '    hijos:',
        '      - nombre: Clásicos',
        '        handle: hombre-clasicos',
        '        regla: { genero: [hombre, unisex], estilo: [clasicos] }',
        '      - nombre: Ofertas',
        '        handle: hombre-ofertas',
        '  - nombre: Mujer',
        '    handle: mujer',
        '    regla: { genero: [mujer], estilo: [clasicos] }',
        'colecciones:',
        '  - nombre: Selección de Don Juan',
        '    handle: seleccion-de-don-juan',
        '    regla: { coleccion: [seleccion-de-don-juan] }',
        'menu:',
        '  - coleccion: seleccion-de-don-juan',
        '  - categoria: hombre',
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
        title: 'Selección de Don Juan',
        handle: 'seleccion-de-don-juan',
        rule: { applies: 'all', conditions: [{ metafield: 'custom.coleccion', value: 'seleccion-de-don-juan' }] },
      },
    ])
    expect(manifest.menu).toEqual([
      { title: 'Selección de Don Juan', collectionHandle: 'seleccion-de-don-juan', url: null, children: [] },
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

    const manifest = buildStructureManifest(structure)

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
    // The brand is the built-in Vendor: no definition, and the seed does not filter by it.
    expect(manifest.metafields.map(({ key }) => key)).toEqual(['genero', 'tipo', 'colecciones'])
    expect(manifest.filters).toEqual([
      { name: 'Género', source: 'metafield', metafield: 'custom.genero' },
      { name: 'Tipo', source: 'metafield', metafield: 'custom.tipo' },
    ])
    expect(manifest.collections).toHaveLength(15)
    expect(manifest.menu.map((item) => [item.title, item.children.map((child) => child.title)])).toEqual([
      ['Men', ['Tops', 'Bottoms', 'Shoes']],
      ['Women', ['Tops', 'Bottoms']],
      ['Unisex', ['Tops', 'Bottoms', 'Shoes', 'Accessories']],
    ])
  })

  test('the vendor campo is a Proveedor condition and the Brand filter, and menu sections expand from the CSV products', async ({
    expect,
  }) => {
    const structure = parse([
      'campos:',
      '  - { nombre: Marca, clave: marca, origen: vendor, filtro: true }',
      '  - { nombre: Género, clave: genero, filtro: true }',
      '  - { nombre: Modelo, clave: modelo }',
      'categorias:',
      '  - nombre: Hombre',
      '    handle: hombre',
      '    regla: { genero: [hombre] }',
      '    hijos:',
      '      - nombre: Clásicos',
      '        handle: hombre-clasicos',
      '        regla: { genero: [hombre], modelo: [Stan Smith] }',
      '        hijos:',
      '          - { nombre: Blancos, handle: hombre-clasicos-blancos }',
      '  - nombre: Nike',
      '    handle: nike',
      '    regla: { marca: [Nike] }',
      'colecciones:',
      '  - { nombre: Rebajas, handle: rebajas }',
      'menu:',
      '  - categoria: hombre',
      '    secciones:',
      '      - { nombre: Estilos, mostrar: subcategorias }',
      '      - { nombre: Marcas, mostrar: { valores: marca } }',
      '      - { nombre: Modelos, mostrar: { valores: modelo, limite: 2 } }',
      '      - nombre: Destacados',
      '        enlaces:',
      '          - { nombre: Stan Smith Adidas, filtro: { marca: [Adidas], modelo: [Stan Smith] } }',
      '          - { coleccion: rebajas }',
      '  - coleccion: rebajas',
      '    secciones:',
      // A manual Collection's members are picked in the admin: the CSV cannot say which, so no values.
      '      - { nombre: Marcas, mostrar: { valores: marca } }',
      '  - categoria: nike',
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
    // In campo order, the brand first.
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
          // Sorted and cut at `limite`; values URL-encoded.
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
      // No secciones: the Category's tree, as before.
      { title: 'Nike', collectionHandle: 'nike', url: null, children: [] },
    ])

    // Without the CSV a `valores` section has nothing to read.
    expect(() => buildStructureManifest(structure)).toThrow(
      'The menu entry "hombre" lists values in "Marcas": pass the product CSV to read them from.',
    )
  })
})
