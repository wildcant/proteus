import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from '@tests/setup/test-extend.js'
import { parseCatalogStructure } from '../utils/catalog-structure/parse-catalog-structure.js'

const yaml = (lines: string[]) => `${lines.join('\n')}\n`

test.describe('parseCatalogStructure', () => {
  test('reads the fields, the nested tree, the collections and the menu, in file order', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - name: Género',
        '    key: genero',
        '    filterable: true',
        '  - name: Estilo',
        '    key: estilo',
        '    filterable: false',
        '  - name: Colecciones',
        '    key: colecciones',
        '  - name: Marca',
        '    key: marca',
        '    source: vendor',
        '    filterable: true',
        'categories:',
        '  - name: Hombre',
        '    handle: hombre',
        '    heading: Ropa de hombre',
        '    rule:',
        '      genero: [hombre, unisex]',
        '      marca: [Nike]',
        '    children:',
        '      - name: Clásicos',
        '        handle: hombre-clasicos',
        '        rule: { genero: [hombre, unisex], estilo: [clasicos] }',
        '      - name: Ofertas',
        '        handle: hombre-ofertas',
        '  - name: Mujer',
        '    handle: mujer',
        'collections:',
        '  - name: Staff picks',
        '    handle: staff-picks',
        '    rule: { colecciones: [staff-picks] }',
        'menu:',
        '  - category: mujer',
        '  - collection: staff-picks',
        '  - category: hombre',
        '    sections:',
        '      - name: Estilos',
        '        show: subcategories',
        '      - name: Marcas',
        '        show: { values: marca }',
        '      - name: Modelos',
        '        show: { values: estilo, limit: 8 }',
        '      - name: Destacados',
        '        links:',
        '          - name: Clásicos Nike',
        '            filter: { marca: [Nike], estilo: [clasicos] }',
        '          - collection: staff-picks',
        '          - { name: Rebajas, category: hombre-ofertas }',
      ]),
    )

    expect(errors).toEqual([])
    expect(structure).toEqual({
      metafields: [
        // `filterable` left out is no filter; `source` left out is a metafield.
        { name: 'Género', key: 'genero', filterable: true, source: 'metafield' },
        { name: 'Estilo', key: 'estilo', filterable: false, source: 'metafield' },
        { name: 'Colecciones', key: 'colecciones', filterable: false, source: 'metafield' },
        // The brand, named by its key like any other field.
        { name: 'Marca', key: 'marca', filterable: true, source: 'vendor' },
      ],
      categories: [
        {
          name: 'Hombre',
          // `heading` is the category page's title; left out, the page shows the name.
          heading: 'Ropa de hombre',
          handle: 'hombre',
          rule: { genero: ['hombre', 'unisex'], marca: ['Nike'] },
          children: [
            {
              name: 'Clásicos',
              heading: null,
              handle: 'hombre-clasicos',
              rule: { genero: ['hombre', 'unisex'], estilo: ['clasicos'] },
              children: [],
            },
            // No rule: a manual Category.
            { name: 'Ofertas', heading: null, handle: 'hombre-ofertas', rule: null, children: [] },
          ],
        },
        { name: 'Mujer', heading: null, handle: 'mujer', rule: null, children: [] },
      ],
      collections: [
        {
          name: 'Staff picks',
          handle: 'staff-picks',
          rule: { colecciones: ['staff-picks'] },
          badge: null,
        },
      ],
      options: [],
      menu: [
        // No sections: the entry brings its children, as it always has.
        { type: 'category', handle: 'mujer', sections: [] },
        { type: 'collection', handle: 'staff-picks', sections: [] },
        {
          type: 'category',
          handle: 'hombre',
          sections: [
            { type: 'subcategories', name: 'Estilos' },
            // `limit` left out shows every value.
            { type: 'values', name: 'Marcas', key: 'marca', limit: null },
            { type: 'values', name: 'Modelos', key: 'estilo', limit: 8 },
            {
              type: 'links',
              name: 'Destacados',
              links: [
                { type: 'filter', name: 'Clásicos Nike', filter: { marca: ['Nike'], estilo: ['clasicos'] } },
                // No name: the store labels it with the Collection's own.
                { type: 'collection', handle: 'staff-picks', name: null },
                { type: 'category', handle: 'hombre-ofertas', name: 'Rebajas' },
              ],
            },
          ],
        },
      ],
      // Left out: search offers nothing, and every filter shows.
      search: { popular: [], trending: [] },
      filters: null,
      card: { subline: null, listSeparator: ', ' },
    })
  })

  test('reads the development fixture clean', async ({ expect }) => {
    const text = readFileSync(resolve(__dirname, '../../../../scripts/seed/catalog-structure.yaml'), 'utf8')
    const { structure, errors } = parseCatalogStructure(text)

    expect(errors).toEqual([])
    expect(structure?.metafields.map((metafield) => metafield.key)).toEqual([
      'genero',
      'tipo',
      'colecciones',
      'marca',
      'modelo',
    ])
    expect(structure?.metafields.find((metafield) => metafield.key === 'marca')).toMatchObject({
      source: 'vendor',
      filterable: true,
    })
    expect(structure?.categories.map((category) => category.handle)).toEqual(['men', 'women', 'unisex', 'shoes'])
    expect(structure?.categories[3]?.heading).toBe('All shoes')
    expect(structure?.filters).toEqual(['genero', 'tipo', 'marca', 'option.Size'])
    expect(structure?.search.trending.map((model) => model.name)).toEqual(['Tops', 'Shoes'])
    expect(structure?.categories[0]?.children.map((child) => child.handle)).toEqual([
      'men-tops',
      'men-bottoms',
      'men-shoes',
    ])
  })

  test('reports every problem with the path it is at', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - name: Género',
        '    key: Género',
        '  - name: Estilo',
        '  - name: Talla',
        '    key: talla',
        '    filterable: si',
        '  - name: Marca',
        '    key: marca',
        '    source: proveedor',
        'categories:',
        '  - name: Hombre',
        '    handle: hombre',
        '    rule: {}',
        '    children:',
        '      - name: Clásicos',
        '        handle: Hombre Clasicos',
        '        rule: { genero: [] }',
        '      - handle: hombre-ofertas',
        '        rule: { genero: hombre }',
        '        orden: 2',
        'collections:',
        '  - name: Rebajas',
        '    handle: rebajas',
        '    rule: [[genero:hombre]]',
        'menu:',
        '  - pagina: inicio',
        '  - category: hombre',
        '    sections:',
        '      - show: subcategories',
        '      - name: Marcas',
        '        show: { values: marca, limit: 0 }',
        '      - name: Modelos',
        '        show: todos',
        '      - name: Destacados',
        '        links:',
        '          - name: Superstar',
        '            filter: { modelo: Superstar }',
      ]),
    )

    expect(structure).toBeNull()
    expect(errors).toEqual([
      { path: 'fields[0].key', message: 'Must be 2 to 64 lowercase letters, digits, "-" or "_", like "gender".' },
      { path: 'fields[1].key', message: 'Must be a key.' },
      { path: 'fields[2].filterable', message: 'Must be true or false.' },
      { path: 'fields[3].source', message: 'Must be "vendor" or "type", or left out for a metafield.' },
      { path: 'categories[0].rule', message: 'Must hold at least one condition.' },
      {
        path: 'categories[0].children[0].handle',
        message: 'Must be lowercase letters and digits joined by hyphens, like "men-tops".',
      },
      { path: 'categories[0].children[0].rule.genero', message: 'Must name at least one value.' },
      { path: 'categories[0].children[1].name', message: 'Must be a name.' },
      { path: 'categories[0].children[1].rule.genero', message: 'Must be a list of values, any one of which matches.' },
      { path: 'categories[0].children[1]', message: 'Unrecognized key: "orden"' },
      { path: 'collections[0].rule', message: 'Must be a mapping of keys to lists of values.' },
      { path: 'menu[0]', message: 'Unrecognized key: "pagina"' },
      { path: 'menu[1].sections[0].name', message: 'Must be a name.' },
      { path: 'menu[1].sections[1].show.limit', message: 'Must be a positive whole number.' },
      {
        path: 'menu[1].sections[2].show',
        message:
          'Must be "subcategories", "{ values: <key>, limit: <n> }", "{ values: <key>, groupBy: <key>, groups: <n>, limit: <n> }" or "{ option: <option> }".',
      },
      {
        path: 'menu[1].sections[3].links[0].filter.modelo',
        message: 'Must be a list of values, any one of which matches.',
      },
    ])
  })

  test('refuses a menu section that names an undeclared key or handle, or mixes its keys', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - { name: Marca, key: marca, source: vendor }',
        'categories:',
        '  - { name: Hombre, handle: hombre }',
        'collections:',
        '  - { name: Rebajas, handle: rebajas }',
        'menu:',
        '  - category: hombre',
        '    collection: rebajas',
        '  - {}',
        '  - category: hombre',
        '    sections:',
        '      - name: Modelos',
        '        show: { values: modelo }',
        '      - name: Vacía',
        '      - name: Las dos',
        '        show: subcategories',
        '        links: []',
        '      - name: Destacados',
        '        links:',
        '          - name: Superstar',
        '            filter: { modelo: [Superstar] }',
        '          - filter: { marca: [Nike] }',
        '          - { category: mujer }',
        '          - { collection: ofertas }',
        '          - { name: Dos destinos, category: hombre, collection: rebajas }',
        '          - { name: Ninguno }',
        '  - collection: rebajas',
        '    sections:',
        '      - name: Estilos',
        '        show: subcategories',
      ]),
    )

    expect(structure).toBeNull()
    const either = 'Must be one of "category: <handle>" or "collection: <handle>".'
    const oneTarget = 'Must have exactly one of filter, category or collection.'
    expect(errors).toEqual([
      { path: 'menu[0]', message: either },
      { path: 'menu[1]', message: either },
      { path: 'menu[2].sections[0].show.values', message: 'No field in the file has the key "modelo".' },
      { path: 'menu[2].sections[1]', message: 'Must have exactly one of show or links.' },
      { path: 'menu[2].sections[2]', message: 'Must have exactly one of show or links.' },
      {
        path: 'menu[2].sections[3].links[0].filter.modelo',
        message: 'No field in the file has the key "modelo".',
      },
      { path: 'menu[2].sections[3].links[1]', message: 'A link with a filter must have a name.' },
      { path: 'menu[2].sections[3].links[2].category', message: 'No category in the file has the handle "mujer".' },
      {
        path: 'menu[2].sections[3].links[3].collection',
        message: 'No collection in the file has the handle "ofertas".',
      },
      { path: 'menu[2].sections[3].links[4]', message: oneTarget },
      { path: 'menu[2].sections[3].links[5]', message: oneTarget },
      { path: 'menu[3].sections[0].show', message: 'A collection has no subcategories.' },
    ])
  })

  test('reads a type field, grouped values, an option section, a section note and an entry footer', async ({
    expect,
  }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - { name: Marca, key: marca, source: vendor }',
        '  - { name: Tipo, key: tipo, source: type, filterable: true }',
        '  - { name: Modelo, key: modelo }',
        'categories:',
        '  - { name: Tenis, handle: tenis, rule: { tipo: [tenis] } }',
        'collections:',
        '  - { name: Los más buscados, handle: los-mas-buscados }',
        'menu:',
        '  - category: tenis',
        '    sections:',
        '      - name: Marcas',
        '        show: { values: modelo, groupBy: marca, groups: 6, limit: 6 }',
        '      - name: Talla',
        '        show: { option: Talla }',
        '        note: Te mostramos solo lo que hay en tu talla.',
        '    footer:',
        '      - { name: Ver todas las marcas, category: tenis }',
        '      - { collection: los-mas-buscados }',
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

  test('refuses a second type field, a grouping without its field or on itself, an empty option, a note that is not text and a footer link to nothing', async ({
    expect,
  }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - { name: Marca, key: marca, source: vendor }',
        '  - { name: Tipo, key: tipo, source: type }',
        '  - { name: Clase, key: clase, source: type }',
        '  - { name: Modelo, key: modelo }',
        'categories:',
        '  - { name: Tenis, handle: tenis }',
        'menu:',
        '  - category: tenis',
        '    sections:',
        '      - name: Sin agrupar',
        '        show: { values: modelo, groups: 6 }',
        '      - name: Sobre sí mismo',
        '        show: { values: modelo, groupBy: modelo }',
        '      - name: Agrupar sin field',
        '        show: { values: modelo, groupBy: linea, groups: 0 }',
        '      - name: Talla',
        '        show: { option: "" }',
        '      - name: Mezcla',
        '        show: { option: Talla, values: modelo }',
        '      - name: Nota',
        '        show: subcategories',
        '        note: [uno]',
        '    footer:',
        '      - { category: hombre }',
        '      - { name: Dos, category: tenis, collection: rebajas }',
      ]),
    )

    expect(structure).toBeNull()
    expect(errors).toEqual([
      { path: 'menu[0].sections[2].show.groups', message: 'Must be a positive whole number.' },
      { path: 'menu[0].sections[3].show.option', message: 'Must not be empty.' },
      {
        path: 'menu[0].sections[4].show',
        message:
          'Must be "subcategories", "{ values: <key>, limit: <n> }", "{ values: <key>, groupBy: <key>, groups: <n>, limit: <n> }" or "{ option: <option> }".',
      },
      { path: 'menu[0].sections[5].note', message: 'Must be a name.' },
    ])

    // The shape is right; what it names is checked next.
    const named = parseCatalogStructure(
      yaml([
        'fields:',
        '  - { name: Tipo, key: tipo, source: type }',
        '  - { name: Clase, key: clase, source: type }',
        '  - { name: Modelo, key: modelo }',
        'categories:',
        '  - { name: Tenis, handle: tenis }',
        'menu:',
        '  - category: tenis',
        '    sections:',
        '      - name: Sin agrupar',
        '        show: { values: modelo, groups: 6 }',
        '      - name: Sobre sí mismo',
        '        show: { values: modelo, groupBy: modelo }',
        '      - name: Agrupar sin field',
        '        show: { values: modelo, groupBy: linea }',
        '    footer:',
        '      - { category: hombre }',
        '      - { name: Dos, category: tenis, collection: rebajas }',
      ]),
    )
    expect(named.errors).toEqual([
      { path: 'fields[1].source', message: 'Only one field can be the type; "tipo" already is.' },
      { path: 'menu[0].sections[0].show.groups', message: 'groups needs groupBy, the field to group by.' },
      { path: 'menu[0].sections[1].show.groupBy', message: 'Must be a different field from values.' },
      { path: 'menu[0].sections[2].show.groupBy', message: 'No field in the file has the key "linea".' },
      { path: 'menu[0].footer[0].category', message: 'No category in the file has the handle "hombre".' },
      { path: 'menu[0].footer[1]', message: 'Must have exactly one of filter, category or collection.' },
    ])
  })

  test('refuses a key or handle used twice, a second vendor field, a rule naming an undeclared key and a menu entry naming an undeclared handle', async ({
    expect,
  }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - { name: Género, key: genero }',
        '  - { name: Sexo, key: genero }',
        '  - { name: Marca, key: marca, source: vendor }',
        '  - { name: Fabricante, key: fabricante, source: vendor }',
        'categories:',
        '  - name: Hombre',
        '    handle: hombre',
        '    rule: { genero: [hombre], estilo: [clasicos] }',
        '    children:',
        '      - name: Hombre',
        '        handle: hombre',
        'collections:',
        '  - name: Rebajas',
        '    handle: rebajas',
        '    rule: { rebajas: [si] }',
        '  - name: Rebajas otra vez',
        '    handle: rebajas',
        'menu:',
        '  - category: mujer',
        // A Collection's handle does not answer for a Category entry.
        '  - category: rebajas',
        '  - collection: rebajas',
      ]),
    )

    expect(structure).toBeNull()
    expect(errors).toEqual([
      { path: 'fields[1].key', message: 'The key "genero" is used more than once.' },
      { path: 'fields[3].source', message: 'Only one field can be the vendor; "marca" already is.' },
      { path: 'categories[0].rule.estilo', message: 'No field in the file has the key "estilo".' },
      { path: 'categories[0].children[0].handle', message: 'The category handle "hombre" is used more than once.' },
      { path: 'collections[0].rule.rebajas', message: 'No field in the file has the key "rebajas".' },
      { path: 'collections[1].handle', message: 'The collection handle "rebajas" is used more than once.' },
      { path: 'menu[0].category', message: 'No category in the file has the handle "mujer".' },
      { path: 'menu[1].category', message: 'No category in the file has the handle "rebajas".' },
    ])
  })

  test('reads search and the filters in order', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - { name: Género, key: genero, filterable: true }',
        '  - { name: Estilo, key: estilo }',
        'search:',
        '  popular: [botas, sandalias]',
        '  trending:',
        '    - { name: Botín Clásico, filter: { estilo: [clasicos] }, note: Clásicos }',
        '    - { name: Todo mujer, filter: { genero: [mujer] } }',
        'filters: [option.Talla, genero]',
      ]),
    )

    expect(errors).toEqual([])
    expect(structure?.search).toEqual({
      popular: ['botas', 'sandalias'],
      trending: [
        { name: 'Botín Clásico', filter: { estilo: ['clasicos'] }, note: 'Clásicos' },
        { name: 'Todo mujer', filter: { genero: ['mujer'] }, note: null },
      ],
    })
    expect(structure?.filters).toEqual(['option.Talla', 'genero'])
  })

  test('refuses a repeated search term or model, and a filter that is no filter', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - { name: Género, key: genero, filterable: true }',
        '  - { name: Estilo, key: estilo }',
        'search:',
        '  popular: [Botas, botas]',
        '  trending:',
        '    - { name: Botín, filter: { suela: [goma] } }',
        '    - { name: botín, filter: { genero: [mujer] } }',
        'filters: [genero, genero, estilo, marca, option.]',
      ]),
    )
    expect(structure).toBeNull()
    expect(errors).toEqual([
      { path: 'search.popular[1]', message: 'The search "botas" is listed more than once.' },
      { path: 'search.trending[1].name', message: 'The model "botín" is listed more than once.' },
      { path: 'search.trending[0].filter.suela', message: 'No field in the file has the key "suela".' },
      { path: 'filters[1]', message: 'The filter "genero" is listed more than once.' },
      { path: 'filters[2]', message: 'The field "estilo" is not a filter; it needs filterable: true.' },
      { path: 'filters[3]', message: 'No field in the file has the key "marca".' },
      { path: 'filters[4]', message: 'Must name the option, like "option.Size".' },
    ])
  })

  test('reads the card’s subline template and list separator', async ({ expect }) => {
    const { structure, errors } = parseCatalogStructure(
      yaml([
        'fields:',
        '  - { name: Género, key: genero }',
        '  - { name: Estilo, key: estilo }',
        'card:',
        '  subline: "{type} para {genero|lower} · {estilo} · {brand}"',
        '  listSeparator: " y "',
      ]),
    )
    expect(errors).toEqual([])
    expect(structure?.card).toEqual({
      subline: '{type} para {genero|lower} · {estilo} · {brand}',
      listSeparator: ' y ',
    })
  })

  test('refuses a subline naming an undeclared key, an unknown modifier or a lone brace', async ({ expect }) => {
    const errorsOf = (subline: string) =>
      parseCatalogStructure(yaml(['fields:', '  - { name: Género, key: genero }', 'card:', `  subline: "${subline}"`]))
        .errors
    expect(errorsOf('{type} para {suela}')).toEqual([
      { path: 'card.subline', message: 'No field in the file has the key "suela", and it is not {type} or {brand}.' },
    ])
    expect(errorsOf('{genero|upper}')).toEqual([
      { path: 'card.subline', message: '"upper" is not a modifier; the one there is is "lower".' },
    ])
    expect(errorsOf('{genero} {type')).toEqual([{ path: 'card.subline', message: 'A "{" or "}" has no partner.' }])
    expect(errorsOf('{} para {genero}')).toEqual([
      { path: 'card.subline', message: 'A placeholder must name a key, like "{type}".' },
    ])
  })

  test('refuses a file that is not YAML, or not a structure', async ({ expect }) => {
    const broken = parseCatalogStructure('categories: [\n')
    expect(broken.structure).toBeNull()
    expect(broken.errors).toHaveLength(1)
    expect(broken.errors[0]?.message).toMatch(/^The file is not valid YAML: /)

    expect(parseCatalogStructure('- hombre\n').errors).toEqual([
      {
        path: '',
        message:
          'The file must be a mapping with fields, categories, collections, options, menu, search, filters and card.',
      },
    ])
  })
})
