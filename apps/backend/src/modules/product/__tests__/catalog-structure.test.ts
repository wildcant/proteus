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
        '  - nombre: Marca',
        '    clave: marca',
        '    origen: vendor',
        '    filtro: true',
        'categorias:',
        '  - nombre: Hombre',
        '    handle: hombre',
        '    regla:',
        '      genero: [hombre, unisex]',
        '      marca: [Nike]',
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
        '    secciones:',
        '      - nombre: Estilos',
        '        mostrar: subcategorias',
        '      - nombre: Marcas',
        '        mostrar: { valores: marca }',
        '      - nombre: Modelos',
        '        mostrar: { valores: estilo, limite: 8 }',
        '      - nombre: Destacados',
        '        enlaces:',
        '          - nombre: Clásicos Nike',
        '            filtro: { marca: [Nike], estilo: [clasicos] }',
        '          - coleccion: seleccion-de-don-juan',
        '          - { nombre: Rebajas, categoria: hombre-ofertas }',
      ]),
    )

    expect(errors).toEqual([])
    expect(structure).toEqual({
      metafields: [
        // `filtro` left out is no filter; `origen` left out is a metafield.
        { name: 'Género', key: 'genero', filterable: true, source: 'metafield' },
        { name: 'Estilo', key: 'estilo', filterable: false, source: 'metafield' },
        { name: 'Colecciones', key: 'colecciones', filterable: false, source: 'metafield' },
        // The brand, named by its clave like any other campo.
        { name: 'Marca', key: 'marca', filterable: true, source: 'vendor' },
      ],
      categories: [
        {
          name: 'Hombre',
          handle: 'hombre',
          rule: { genero: ['hombre', 'unisex'], marca: ['Nike'] },
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
        // No secciones: the entry brings its children, as it always has.
        { type: 'category', handle: 'mujer', sections: [] },
        { type: 'collection', handle: 'seleccion-de-don-juan', sections: [] },
        {
          type: 'category',
          handle: 'hombre',
          sections: [
            { type: 'subcategories', name: 'Estilos' },
            // `limite` left out shows every value.
            { type: 'values', name: 'Marcas', key: 'marca', limit: null },
            { type: 'values', name: 'Modelos', key: 'estilo', limit: 8 },
            {
              type: 'links',
              name: 'Destacados',
              links: [
                { type: 'filter', name: 'Clásicos Nike', filter: { marca: ['Nike'], estilo: ['clasicos'] } },
                // No nombre: the store labels it with the Collection's own.
                { type: 'collection', handle: 'seleccion-de-don-juan', name: null },
                { type: 'category', handle: 'hombre-ofertas', name: 'Rebajas' },
              ],
            },
          ],
        },
      ],
    })
  })

  test('reads the development fixture clean', async ({ expect }) => {
    const text = readFileSync(resolve(__dirname, '../../../../scripts/seed/catalog-structure.yaml'), 'utf8')
    const { structure, errors } = parseCatalogStructure(text)

    expect(errors).toEqual([])
    expect(structure?.metafields.map((metafield) => metafield.key)).toEqual(['genero', 'tipo', 'colecciones', 'marca'])
    expect(structure?.metafields.find((metafield) => metafield.key === 'marca')).toMatchObject({
      source: 'vendor',
      filterable: false,
    })
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
        '  - nombre: Marca',
        '    clave: marca',
        '    origen: proveedor',
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
        '  - categoria: hombre',
        '    secciones:',
        '      - mostrar: subcategorias',
        '      - nombre: Marcas',
        '        mostrar: { valores: marca, limite: 0 }',
        '      - nombre: Modelos',
        '        mostrar: todos',
        '      - nombre: Destacados',
        '        enlaces:',
        '          - nombre: Superstar',
        '            filtro: { modelo: Superstar }',
      ]),
    )

    expect(structure).toBeNull()
    expect(errors).toEqual([
      { path: 'campos[0].clave', message: 'Must be 2 to 64 lowercase letters, digits, "-" or "_", like "genero".' },
      { path: 'campos[1].clave', message: 'Must be a clave.' },
      { path: 'campos[2].filtro', message: 'Must be true or false.' },
      { path: 'campos[3].origen', message: 'Must be "vendor" or "type", or left out for a metafield.' },
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
      { path: 'menu[0]', message: 'Unrecognized key: "pagina"' },
      { path: 'menu[1].secciones[0].nombre', message: 'Must be a name.' },
      { path: 'menu[1].secciones[1].mostrar.limite', message: 'Must be a positive whole number.' },
      {
        path: 'menu[1].secciones[2].mostrar',
        message:
          'Must be "subcategorias", "{ valores: <clave>, limite: <n> }", "{ valores: <clave>, agrupar: <clave>, grupos: <n>, limite: <n> }" or "{ opcion: <option> }".',
      },
      {
        path: 'menu[1].secciones[3].enlaces[0].filtro.modelo',
        message: 'Must be a list of values, any one of which matches.',
      },
    ])
  })

  test('refuses a menu section that names an undeclared clave or handle, or mixes its keys', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'campos:',
        '  - { nombre: Marca, clave: marca, origen: vendor }',
        'categorias:',
        '  - { nombre: Hombre, handle: hombre }',
        'colecciones:',
        '  - { nombre: Rebajas, handle: rebajas }',
        'menu:',
        '  - categoria: hombre',
        '    coleccion: rebajas',
        '  - {}',
        '  - categoria: hombre',
        '    secciones:',
        '      - nombre: Modelos',
        '        mostrar: { valores: modelo }',
        '      - nombre: Vacía',
        '      - nombre: Las dos',
        '        mostrar: subcategorias',
        '        enlaces: []',
        '      - nombre: Destacados',
        '        enlaces:',
        '          - nombre: Superstar',
        '            filtro: { modelo: [Superstar] }',
        '          - filtro: { marca: [Nike] }',
        '          - { categoria: mujer }',
        '          - { coleccion: ofertas }',
        '          - { nombre: Dos destinos, categoria: hombre, coleccion: rebajas }',
        '          - { nombre: Ninguno }',
        '  - coleccion: rebajas',
        '    secciones:',
        '      - nombre: Estilos',
        '        mostrar: subcategorias',
      ]),
    )

    expect(structure).toBeNull()
    const either = 'Must be one of "categoria: <handle>" or "coleccion: <handle>".'
    const oneTarget = 'Must have exactly one of filtro, categoria or coleccion.'
    expect(errors).toEqual([
      { path: 'menu[0]', message: either },
      { path: 'menu[1]', message: either },
      { path: 'menu[2].secciones[0].mostrar.valores', message: 'No campo in the file has the clave "modelo".' },
      { path: 'menu[2].secciones[1]', message: 'Must have exactly one of mostrar or enlaces.' },
      { path: 'menu[2].secciones[2]', message: 'Must have exactly one of mostrar or enlaces.' },
      {
        path: 'menu[2].secciones[3].enlaces[0].filtro.modelo',
        message: 'No campo in the file has the clave "modelo".',
      },
      { path: 'menu[2].secciones[3].enlaces[1]', message: 'A link with a filtro must have a nombre.' },
      { path: 'menu[2].secciones[3].enlaces[2].categoria', message: 'No category in the file has the handle "mujer".' },
      {
        path: 'menu[2].secciones[3].enlaces[3].coleccion',
        message: 'No collection in the file has the handle "ofertas".',
      },
      { path: 'menu[2].secciones[3].enlaces[4]', message: oneTarget },
      { path: 'menu[2].secciones[3].enlaces[5]', message: oneTarget },
      { path: 'menu[3].secciones[0].mostrar', message: 'A collection has no subcategorias.' },
    ])
  })

  test('reads a type campo, grouped values, an option section, a section nota and an entry pie', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'campos:',
        '  - { nombre: Marca, clave: marca, origen: vendor }',
        '  - { nombre: Tipo, clave: tipo, origen: type, filtro: true }',
        '  - { nombre: Modelo, clave: modelo }',
        'categorias:',
        '  - { nombre: Tenis, handle: tenis, regla: { tipo: [tenis] } }',
        'colecciones:',
        '  - { nombre: Los más buscados, handle: los-mas-buscados }',
        'menu:',
        '  - categoria: tenis',
        '    secciones:',
        '      - nombre: Marcas',
        '        mostrar: { valores: modelo, agrupar: marca, grupos: 6, limite: 6 }',
        '      - nombre: Talla',
        '        mostrar: { opcion: Talla }',
        '        nota: Te mostramos solo lo que hay en tu talla.',
        '    pie:',
        '      - { nombre: Ver todas las marcas, categoria: tenis }',
        '      - { coleccion: los-mas-buscados }',
      ]),
    )

    expect(errors).toEqual([])
    expect(structure?.metafields[1]).toEqual({ name: 'Tipo', key: 'tipo', filterable: true, source: 'type' })
    expect(structure?.menu).toEqual([
      {
        type: 'category',
        handle: 'tenis',
        sections: [
          { type: 'groups', name: 'Marcas', key: 'modelo', groupKey: 'marca', groups: 6, limit: 6 },
          { type: 'option', name: 'Talla', option: 'Talla', note: 'Te mostramos solo lo que hay en tu talla.' },
        ],
        footer: [
          { type: 'category', handle: 'tenis', name: 'Ver todas las marcas' },
          { type: 'collection', handle: 'los-mas-buscados', name: null },
        ],
      },
    ])
  })

  test('refuses a second type campo, a grouping without its campo or on itself, an empty option, a nota that is not text and a pie link to nothing', async ({
    expect,
  }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'campos:',
        '  - { nombre: Marca, clave: marca, origen: vendor }',
        '  - { nombre: Tipo, clave: tipo, origen: type }',
        '  - { nombre: Clase, clave: clase, origen: type }',
        '  - { nombre: Modelo, clave: modelo }',
        'categorias:',
        '  - { nombre: Tenis, handle: tenis }',
        'menu:',
        '  - categoria: tenis',
        '    secciones:',
        '      - nombre: Sin agrupar',
        '        mostrar: { valores: modelo, grupos: 6 }',
        '      - nombre: Sobre sí mismo',
        '        mostrar: { valores: modelo, agrupar: modelo }',
        '      - nombre: Agrupar sin campo',
        '        mostrar: { valores: modelo, agrupar: linea, grupos: 0 }',
        '      - nombre: Talla',
        '        mostrar: { opcion: "" }',
        '      - nombre: Mezcla',
        '        mostrar: { opcion: Talla, valores: modelo }',
        '      - nombre: Nota',
        '        mostrar: subcategorias',
        '        nota: [uno]',
        '    pie:',
        '      - { categoria: hombre }',
        '      - { nombre: Dos, categoria: tenis, coleccion: rebajas }',
      ]),
    )

    expect(structure).toBeNull()
    expect(errors).toEqual([
      { path: 'menu[0].secciones[2].mostrar.grupos', message: 'Must be a positive whole number.' },
      { path: 'menu[0].secciones[3].mostrar.opcion', message: 'Must not be empty.' },
      {
        path: 'menu[0].secciones[4].mostrar',
        message:
          'Must be "subcategorias", "{ valores: <clave>, limite: <n> }", "{ valores: <clave>, agrupar: <clave>, grupos: <n>, limite: <n> }" or "{ opcion: <option> }".',
      },
      { path: 'menu[0].secciones[5].nota', message: 'Must be a name.' },
    ])

    // The shape is right; what it names is checked next.
    const named = parseCatalogStructure(
      yaml([
        'campos:',
        '  - { nombre: Tipo, clave: tipo, origen: type }',
        '  - { nombre: Clase, clave: clase, origen: type }',
        '  - { nombre: Modelo, clave: modelo }',
        'categorias:',
        '  - { nombre: Tenis, handle: tenis }',
        'menu:',
        '  - categoria: tenis',
        '    secciones:',
        '      - nombre: Sin agrupar',
        '        mostrar: { valores: modelo, grupos: 6 }',
        '      - nombre: Sobre sí mismo',
        '        mostrar: { valores: modelo, agrupar: modelo }',
        '      - nombre: Agrupar sin campo',
        '        mostrar: { valores: modelo, agrupar: linea }',
        '    pie:',
        '      - { categoria: hombre }',
        '      - { nombre: Dos, categoria: tenis, coleccion: rebajas }',
      ]),
    )
    expect(named.errors).toEqual([
      { path: 'campos[1].origen', message: 'Only one campo can be the type; "tipo" already is.' },
      { path: 'menu[0].secciones[0].mostrar.grupos', message: 'grupos needs agrupar, the campo to group by.' },
      { path: 'menu[0].secciones[1].mostrar.agrupar', message: 'Must be a different campo from valores.' },
      { path: 'menu[0].secciones[2].mostrar.agrupar', message: 'No campo in the file has the clave "linea".' },
      { path: 'menu[0].pie[0].categoria', message: 'No category in the file has the handle "hombre".' },
      { path: 'menu[0].pie[1]', message: 'Must have exactly one of filtro, categoria or coleccion.' },
    ])
  })

  test('refuses a clave or handle used twice, a second vendor campo, a rule naming an undeclared clave and a menu entry naming an undeclared handle', async ({
    expect,
  }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'campos:',
        '  - { nombre: Género, clave: genero }',
        '  - { nombre: Sexo, clave: genero }',
        '  - { nombre: Marca, clave: marca, origen: vendor }',
        '  - { nombre: Fabricante, clave: fabricante, origen: vendor }',
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
      { path: 'campos[3].origen', message: 'Only one campo can be the vendor; "marca" already is.' },
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
