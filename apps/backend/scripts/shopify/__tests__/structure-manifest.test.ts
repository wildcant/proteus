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
        '  - { nombre: Género, clave: genero }',
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

    expect(manifest.collections).toEqual([
      {
        title: 'Hombre',
        handle: 'hombre',
        rule: { applies: 'any', tags: ['genero:hombre', 'genero:unisex'] },
      },
      {
        title: 'Hombre › Clásicos',
        handle: 'hombre-clasicos',
        rule: null,
        unsupported:
          'The rule [[genero:hombre, genero:unisex], [estilo:clasicos]] mixes "all" and "any": a Shopify collection matches all of its conditions or any of them, never both. Tag the products so each condition is one tag, or make it a single list of alternatives.',
      },
      { title: 'Hombre › Ofertas', handle: 'hombre-ofertas', rule: null },
      {
        title: 'Mujer',
        handle: 'mujer',
        rule: { applies: 'all', tags: ['genero:mujer', 'estilo:clasicos'] },
      },
      {
        title: 'Selección de Don Juan',
        handle: 'seleccion-de-don-juan',
        rule: { applies: 'all', tags: ['coleccion:seleccion-de-don-juan'] },
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
      rule: { applies: 'all', tags: ['genero:men', 'tipo:tops'] },
    })
    expect(manifest.collections).toHaveLength(16)
    expect(manifest.menu.map((item) => [item.title, item.children.map((child) => child.title)])).toEqual([
      ['Men', ['Tops', 'Bottoms', 'Shoes', 'Accessories']],
      ['Women', ['Tops', 'Bottoms']],
      ['Unisex', ['Tops', 'Bottoms', 'Shoes', 'Accessories']],
    ])
  })
})
