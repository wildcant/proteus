import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from '@tests/setup/test-extend.js'
import { parseCatalogStructure } from '../utils/catalog-structure/parse-catalog-structure.js'

const yaml = (lines: string[]) => `${lines.join('\n')}\n`

test.describe('parseCatalogStructure', () => {
  test('reads the nested tree, the collections and the menu, in file order', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'categorias:',
        '  - nombre: Hombre',
        '    handle: hombre',
        '    regla: [[genero:hombre, genero:unisex]]',
        '    hijos:',
        '      - nombre: Clásicos',
        '        handle: hombre-clasicos',
        '        regla: [[genero:hombre, genero:unisex], [estilo:clasicos]]',
        '      - nombre: Ofertas',
        '        handle: hombre-ofertas',
        '  - nombre: Mujer',
        '    handle: mujer',
        'colecciones:',
        '  - nombre: Selección de Don Juan',
        '    handle: seleccion-de-don-juan',
        '    regla: [[coleccion:seleccion-de-don-juan]]',
        'menu:',
        '  - categoria: mujer',
        '  - coleccion: seleccion-de-don-juan',
        '  - categoria: hombre',
      ]),
    )

    expect(errors).toEqual([])
    expect(structure).toEqual({
      categories: [
        {
          name: 'Hombre',
          handle: 'hombre',
          rule: [['genero:hombre', 'genero:unisex']],
          children: [
            {
              name: 'Clásicos',
              handle: 'hombre-clasicos',
              rule: [['genero:hombre', 'genero:unisex'], ['estilo:clasicos']],
              children: [],
            },
            // No rule: a manual Category.
            { name: 'Ofertas', handle: 'hombre-ofertas', rule: null, children: [] },
          ],
        },
        { name: 'Mujer', handle: 'mujer', rule: null, children: [] },
      ],
      collections: [
        { name: 'Selección de Don Juan', handle: 'seleccion-de-don-juan', rule: [['coleccion:seleccion-de-don-juan']] },
      ],
      menu: [
        { type: 'category', handle: 'mujer' },
        { type: 'collection', handle: 'seleccion-de-don-juan' },
        { type: 'category', handle: 'hombre' },
      ],
    })
  })

  test('reads the development fixture clean', async ({ expect }) => {
    const text = readFileSync(resolve(__dirname, '../../../../scripts/seed/catalog-structure.yaml'), 'utf8')
    const { structure, errors } = parseCatalogStructure(text)

    expect(errors).toEqual([])
    expect(structure?.categories.map((category) => category.handle)).toEqual(['men', 'women', 'unisex'])
    expect(structure?.categories[0]?.children.map((child) => child.handle)).toEqual([
      'men-tops',
      'men-bottoms',
      'men-shoes',
      'men-accessories',
    ])
  })

  test('reports every problem with the path it is at', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'categorias:',
        '  - nombre: Hombre',
        '    handle: hombre',
        '    hijos:',
        '      - nombre: Clásicos',
        '        handle: Hombre Clasicos',
        '      - handle: hombre-ofertas',
        '        regla: [[]]',
        '        orden: 2',
        'colecciones:',
        '  - nombre: Rebajas',
        '    handle: rebajas',
        '    regla: genero:hombre',
        'menu:',
        '  - pagina: inicio',
      ]),
    )

    expect(structure).toBeNull()
    expect(errors).toEqual([
      {
        path: 'categorias[0].hijos[0].handle',
        message: 'Must be lowercase letters and digits joined by hyphens, like "hombre-clasicos".',
      },
      { path: 'categorias[0].hijos[1].nombre', message: 'Must be a name.' },
      { path: 'categorias[0].hijos[1].regla[0]', message: 'Must name at least one tag.' },
      { path: 'categorias[0].hijos[1]', message: 'Unrecognized key: "orden"' },
      { path: 'colecciones[0].regla', message: 'Must be a list of conditions, each a list of tags.' },
      { path: 'menu[0]', message: 'Must be one of "categoria: <handle>" or "coleccion: <handle>".' },
    ])
  })

  test('refuses a handle used twice and a menu entry naming a handle the file does not declare', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'categorias:',
        '  - nombre: Hombre',
        '    handle: hombre',
        '    hijos:',
        '      - nombre: Hombre',
        '        handle: hombre',
        'colecciones:',
        '  - nombre: Rebajas',
        '    handle: rebajas',
        '  - nombre: Rebajas otra vez',
        '    handle: rebajas',
        'menu:',
        '  - categoria: mujer',
        // A Collection's handle does not answer for a Category entry.
        '  - categoria: rebajas',
        '  - coleccion: rebajas',
      ]),
    )

    expect(structure).toBeNull()
    expect(errors).toEqual([
      { path: 'categorias[0].hijos[0].handle', message: 'The category handle "hombre" is used more than once.' },
      { path: 'colecciones[1].handle', message: 'The collection handle "rebajas" is used more than once.' },
      { path: 'menu[0].categoria', message: 'No category in the file has the handle "mujer".' },
      { path: 'menu[1].categoria', message: 'No category in the file has the handle "rebajas".' },
    ])
  })

  test('refuses a file that is not YAML, or not a structure', async ({ expect }) => {
    const broken = parseCatalogStructure('categorias: [\n')
    expect(broken.structure).toBeNull()
    expect(broken.errors).toHaveLength(1)
    expect(broken.errors[0]?.message).toMatch(/^The file is not valid YAML: /)

    expect(parseCatalogStructure('- hombre\n').errors).toEqual([
      { path: '', message: 'The file must be a mapping with categorias, colecciones and menu.' },
    ])
  })
})
