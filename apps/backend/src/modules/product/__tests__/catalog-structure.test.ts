import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from '@tests/setup/test-extend.js'
import { parseCatalogStructure } from '../utils/catalog-structure/parse-catalog-structure.js'

const yaml = (lines: string[]) => `${lines.join('\n')}\n`

test.describe('parseCatalogStructure', () => {
  test('reads the campos, the nested tree, the collections and the menu, in file order', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'campos:',
        '  - nombre: Género',
        '    clave: genero',
        '    filtro: true',
        '  - nombre: Estilo',
        '    clave: estilo',
        '    filtro: false',
        '  - nombre: Colecciones',
        '    clave: colecciones',
        'categorias:',
        '  - nombre: Hombre',
        '    handle: hombre',
        '    regla:',
        '      genero: [hombre, unisex]',
        '    hijos:',
        '      - nombre: Clásicos',
        '        handle: hombre-clasicos',
        '        regla: { genero: [hombre, unisex], estilo: [clasicos] }',
        '      - nombre: Ofertas',
        '        handle: hombre-ofertas',
        '  - nombre: Mujer',
        '    handle: mujer',
        'colecciones:',
        '  - nombre: Selección de Don Juan',
        '    handle: seleccion-de-don-juan',
        '    regla: { colecciones: [seleccion-de-don-juan] }',
        'menu:',
        '  - categoria: mujer',
        '  - coleccion: seleccion-de-don-juan',
        '  - categoria: hombre',
      ]),
    )

    expect(errors).toEqual([])
    expect(structure).toEqual({
      metafields: [
        // `filtro` left out is no filter.
        { name: 'Género', key: 'genero', filterable: true },
        { name: 'Estilo', key: 'estilo', filterable: false },
        { name: 'Colecciones', key: 'colecciones', filterable: false },
      ],
      categories: [
        {
          name: 'Hombre',
          handle: 'hombre',
          rule: { genero: ['hombre', 'unisex'] },
          children: [
            {
              name: 'Clásicos',
              handle: 'hombre-clasicos',
              rule: { genero: ['hombre', 'unisex'], estilo: ['clasicos'] },
              children: [],
            },
            // No rule: a manual Category.
            { name: 'Ofertas', handle: 'hombre-ofertas', rule: null, children: [] },
          ],
        },
        { name: 'Mujer', handle: 'mujer', rule: null, children: [] },
      ],
      collections: [
        {
          name: 'Selección de Don Juan',
          handle: 'seleccion-de-don-juan',
          rule: { colecciones: ['seleccion-de-don-juan'] },
        },
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
    expect(structure?.metafields.map((metafield) => metafield.key)).toEqual(['genero', 'tipo', 'colecciones'])
    expect(structure?.categories.map((category) => category.handle)).toEqual(['men', 'women', 'unisex'])
    expect(structure?.categories[0]?.children.map((child) => child.handle)).toEqual([
      'men-tops',
      'men-bottoms',
      'men-shoes',
    ])
  })

  test('reports every problem with the path it is at', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'campos:',
        '  - nombre: Género',
        '    clave: Género',
        '  - nombre: Estilo',
        '  - nombre: Talla',
        '    clave: talla',
        '    filtro: si',
        'categorias:',
        '  - nombre: Hombre',
        '    handle: hombre',
        '    regla: {}',
        '    hijos:',
        '      - nombre: Clásicos',
        '        handle: Hombre Clasicos',
        '        regla: { genero: [] }',
        '      - handle: hombre-ofertas',
        '        regla: { genero: hombre }',
        '        orden: 2',
        'colecciones:',
        '  - nombre: Rebajas',
        '    handle: rebajas',
        '    regla: [[genero:hombre]]',
        'menu:',
        '  - pagina: inicio',
      ]),
    )

    expect(structure).toBeNull()
    expect(errors).toEqual([
      { path: 'campos[0].clave', message: 'Must be 2 to 64 lowercase letters, digits, "-" or "_", like "genero".' },
      { path: 'campos[1].clave', message: 'Must be a clave.' },
      { path: 'campos[2].filtro', message: 'Must be true or false.' },
      { path: 'categorias[0].regla', message: 'Must hold at least one condition.' },
      {
        path: 'categorias[0].hijos[0].handle',
        message: 'Must be lowercase letters and digits joined by hyphens, like "hombre-clasicos".',
      },
      { path: 'categorias[0].hijos[0].regla.genero', message: 'Must name at least one value.' },
      { path: 'categorias[0].hijos[1].nombre', message: 'Must be a name.' },
      { path: 'categorias[0].hijos[1].regla.genero', message: 'Must be a list of values, any one of which matches.' },
      { path: 'categorias[0].hijos[1]', message: 'Unrecognized key: "orden"' },
      { path: 'colecciones[0].regla', message: 'Must be a mapping of claves to lists of values.' },
      { path: 'menu[0]', message: 'Must be one of "categoria: <handle>" or "coleccion: <handle>".' },
    ])
  })

  test('refuses a clave or handle used twice, a rule naming an undeclared clave and a menu entry naming an undeclared handle', async ({
    expect,
  }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'campos:',
        '  - { nombre: Género, clave: genero }',
        '  - { nombre: Sexo, clave: genero }',
        'categorias:',
        '  - nombre: Hombre',
        '    handle: hombre',
        '    regla: { genero: [hombre], estilo: [clasicos] }',
        '    hijos:',
        '      - nombre: Hombre',
        '        handle: hombre',
        'colecciones:',
        '  - nombre: Rebajas',
        '    handle: rebajas',
        '    regla: { rebajas: [si] }',
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
      { path: 'campos[1].clave', message: 'The clave "genero" is used more than once.' },
      { path: 'categorias[0].regla.estilo', message: 'No campo in the file has the clave "estilo".' },
      { path: 'categorias[0].hijos[0].handle', message: 'The category handle "hombre" is used more than once.' },
      { path: 'colecciones[0].regla.rebajas', message: 'No campo in the file has the clave "rebajas".' },
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
      { path: '', message: 'The file must be a mapping with campos, categorias, colecciones and menu.' },
    ])
  })
})
