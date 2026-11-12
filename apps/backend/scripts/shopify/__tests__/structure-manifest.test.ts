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
      { name: 'Género', namespace: 'custom', key: 'genero', type: 'list.single_line_text_field', filter: true },
      { name: 'Estilo', namespace: 'custom', key: 'estilo', type: 'list.single_line_text_field', filter: false },
      { name: 'Colección', namespace: 'custom', key: 'coleccion', type: 'list.single_line_text_field', filter: false },
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
      { title: 'Selección de Don Juan', collectionHandle: 'seleccion-de-don-juan', children: [] },
      {
        title: 'Hombre',
        collectionHandle: 'hombre',
        children: [
          { title: 'Clásicos', collectionHandle: 'hombre-clasicos', children: [] },
          { title: 'Ofertas', collectionHandle: 'hombre-ofertas', children: [] },
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
    expect(manifest.metafields.map(({ key, filter }) => [key, filter])).toEqual([
      ['genero', true],
      ['tipo', true],
      ['colecciones', false],
    ])
    expect(manifest.collections).toHaveLength(15)
    expect(manifest.menu.map((item) => [item.title, item.children.map((child) => child.title)])).toEqual([
      ['Men', ['Tops', 'Bottoms', 'Shoes']],
      ['Women', ['Tops', 'Bottoms']],
      ['Unisex', ['Tops', 'Bottoms', 'Shoes', 'Accessories']],
    ])
  })
})
