import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CatalogStructureCategoryDTO,
  CatalogStructureDTO,
  ImportedProductDTO,
  ProductGroupingRuleDTO,
  ProductMetafieldType,
} from '../../src/core/types/product/common.js'
import type {
  StoreNavigationEntryDTO,
  StoreNavigationLinkDTO,
  StoreNavigationSectionDTO,
} from '../../src/core/types/store/common.js'
import { parseCatalogStructure } from '../../src/modules/product/utils/catalog-structure/parse-catalog-structure.js'
import { matchesGroupingRule } from '../../src/modules/product/utils/grouping-rule.js'
import { parseShopifyCsv } from '../../src/modules/product/utils/shopify-csv/parse-shopify-csv.js'

/**
 * Turns a structure file into what the Shopify admin needs: the product metafield definitions its
 * rules read, one automated collection per Category and Collection, the nested main menu and the
 * storefront filters. The `shopify-sync` skill applies it.
 *
 *   pnpm --filter backend exec tsx scripts/shopify/structure-manifest.ts [estructura.yaml] [catalogo.csv]
 *
 * Prints the manifest as JSON; with no path it reads the seed `catalog-structure.yaml`. A menu with a
 * `valores`, grouped `valores` or `opcion` section needs the product CSV: Shopify menus are static, so
 * the values are read off the CSV's products and written out as menu items.
 */

/** A product metafield definition. Every one is created as a collection condition, which is what Proteus' rules read it for. */
type ShopifyMetafieldDefinition = {
  name: string
  namespace: 'custom'
  key: string
  type: ProductMetafieldType
}

/**
 * One storefront filter in Search & Discovery, in the structure file's campo order: a product
 * metafield (`custom.genero`), the built-in Vendor, which the app lists as "Brand", or the built-in
 * Product type.
 */
type ShopifyFilter =
  | { name: string; source: 'metafield'; metafield: string }
  | { name: string; source: 'vendor' | 'type' }

/**
 * One collection condition: the product's `metafield` (`custom.genero`) list holds `value`, its
 * Vendor (`field: 'vendor'`, "Proveedor es igual a") is `value`, or its Product type
 * (`field: 'type'`, "Tipo de producto es igual a") is `value`.
 */
type ShopifyCollectionCondition = { metafield: string; value: string } | { field: 'vendor' | 'type'; value: string }

/** A smart collection's conditions, matched on all of them or on any of them. */
type ShopifyCollectionRule = { applies: 'all' | 'any'; conditions: ShopifyCollectionCondition[] }

/**
 * `rule` null is a manual collection: the file gives no rule, or one Shopify can't express, and then
 * `unsupported` says why.
 */
type ShopifyCollection = {
  title: string
  handle: string
  rule: ShopifyCollectionRule | null
  unsupported?: string
}

/**
 * One menu item, linked to the collection `collectionHandle`, or — when `url` is set — to that URL,
 * a collection page narrowed by Search & Discovery filter params.
 */
type ShopifyMenuItem = { title: string; collectionHandle: string; url: string | null; children: ShopifyMenuItem[] }

type ShopifyStructureManifest = {
  metafields: ShopifyMetafieldDefinition[]
  filters: ShopifyFilter[]
  collections: ShopifyCollection[]
  menu: ShopifyMenuItem[]
}

/** What a menu section reads of a CSV product. */
type ManifestProduct = Pick<ImportedProductDTO, 'brand' | 'type' | 'metafields' | 'options'>

/** Which campos are the product's built-in Vendor and Product type, by key. */
type BuiltinKeys = { vendorKey: string | undefined; typeKey: string | undefined }

/** One value of a field among the products a rule matches, with how many hold it. */
type ValueCount = { value: string; count: number }

const DEFAULT_STRUCTURE_PATH = path.join(import.meta.dirname, '../seed/catalog-structure.yaml')

/**
 * A Category's collection is titled with its ancestors (`Men › Tops`) because sibling trees reuse
 * names, and the menu's link picker finds a collection by title. Its menu item keeps the plain name.
 *
 * A menu entry with sections gets one child per section, holding that section's links, so the tree
 * stays within Shopify's three levels (Hombre › Marcas › Nike). A grouped section gets one child per
 * group instead (Tenis › Adidas › Samba), the group itself linking the entry filtered by it, and the
 * entry's `pie` links follow its sections. A section's `nota` has no place in a Shopify menu.
 * `products` are the CSV's, which `valores` and `opcion` sections read their values from; it is
 * required only when the menu has one.
 */
export function buildStructureManifest(
  structure: CatalogStructureDTO,
  products?: ManifestProduct[],
): ShopifyStructureManifest {
  const builtins: BuiltinKeys = {
    vendorKey: structure.metafields.find((metafield) => metafield.source === 'vendor')?.key,
    typeKey: structure.metafields.find((metafield) => metafield.source === 'type')?.key,
  }
  const collections: ShopifyCollection[] = []
  const categoryItems = new Map<string, ShopifyMenuItem>()
  const categories = new Map<string, CatalogStructureCategoryDTO>()

  const visit = (category: CatalogStructureCategoryDTO, ancestors: string[]): ShopifyMenuItem => {
    const titles = [...ancestors, category.name]
    collections.push(toCollection(titles.join(' › '), category.handle, category.rule, builtins))
    const item = {
      title: category.name,
      collectionHandle: category.handle,
      url: null,
      children: category.children.map((child) => visit(child, titles)),
    }
    categoryItems.set(category.handle, item)
    categories.set(category.handle, category)
    return item
  }
  for (const category of structure.categories) visit(category, [])

  const collectionsByHandle = new Map(structure.collections.map((collection) => [collection.handle, collection]))
  for (const collection of structure.collections) {
    collections.push(toCollection(collection.name, collection.handle, collection.rule, builtins))
  }

  /** Search & Discovery's filter param for a campo, or for an option (`option: Talla`). */
  const paramOf = (key: string) => {
    if (key === builtins.vendorKey) return 'filter.p.vendor'
    if (key === builtins.typeKey) return 'filter.p.product_type'
    return `filter.p.m.custom.${key}`
  }
  const fieldUrl = (handle: string, filter: Record<string, string[]>, option?: string) => {
    const params = Object.entries(filter).flatMap(([key, values]) =>
      values.map((value) => {
        const name = option ? `filter.v.option.${option.toLowerCase()}` : paramOf(key)
        return `${name}=${encodeURIComponent(value)}`
      }),
    )
    return `/collections/${handle}?${params.join('&')}`
  }

  const leaf = (title: string, collectionHandle: string, url: string | null = null): ShopifyMenuItem => ({
    title,
    collectionHandle,
    url,
    children: [],
  })
  const linkItem = (entry: StoreNavigationEntryDTO, link: StoreNavigationLinkDTO): ShopifyMenuItem => {
    if (link.type === 'filter') return leaf(link.name, entry.handle, fieldUrl(entry.handle, link.filter))
    // The parser guarantees the handle names a grouping the file declares.
    const name =
      link.type === 'category' ? categories.get(link.handle)?.name : collectionsByHandle.get(link.handle)?.name
    return leaf(link.name ?? name ?? link.handle, link.handle)
  }
  /** The CSV products in `entry`'s grouping. A manual one's members are picked in the admin, so the CSV cannot say. */
  const productsOf = (entry: StoreNavigationEntryDTO, section: StoreNavigationSectionDTO): ManifestProduct[] => {
    if (!products) {
      throw new Error(
        `The menu entry "${entry.handle}" lists values in "${section.name}": pass the product CSV to read them from.`,
      )
    }
    const rule =
      entry.type === 'category' ? categories.get(entry.handle)?.rule : collectionsByHandle.get(entry.handle)?.rule
    if (!rule) return []
    const caseInsensitiveKeys = caseInsensitive(builtins)
    return products.filter((product) => matchesGroupingRule(rule, fieldsOf(product, builtins), caseInsensitiveKeys))
  }

  /** The children a section adds under its entry: one titled item holding its links, or one per group. */
  const sectionItems = (entry: StoreNavigationEntryDTO, section: StoreNavigationSectionDTO): ShopifyMenuItem[] => {
    const titled = (children: ShopifyMenuItem[]) => [
      { title: section.name, collectionHandle: entry.handle, url: null, children },
    ]
    if (section.type === 'subcategories') {
      // Their own children would be a fourth level.
      return titled((categories.get(entry.handle)?.children ?? []).map((child) => leaf(child.name, child.handle)))
    }
    if (section.type === 'values') {
      const values = countValues(productsOf(entry, section), section.key, builtins).sort(alphabetically)
      const shown = section.limit === null ? values : values.slice(0, section.limit)
      return titled(
        shown.map(({ value }) => leaf(value, entry.handle, fieldUrl(entry.handle, { [section.key]: [value] }))),
      )
    }
    if (section.type === 'option') {
      const values = offeredOptionValues(productsOf(entry, section), section.option)
      return titled(
        values.map((value) =>
          leaf(value, entry.handle, fieldUrl(entry.handle, { [section.option]: [value] }, section.option)),
        ),
      )
    }
    if (section.type === 'groups') {
      const members = productsOf(entry, section)
      const groups = countValues(members, section.groupKey, builtins).sort(mostFirst)
      const shownGroups = section.groups === null ? groups : groups.slice(0, section.groups)
      return shownGroups.map(({ value: group }) => {
        const identity = builtinIdentity(section.groupKey, group, builtins)
        const inGroup = members.filter((product) =>
          [...(fieldsOf(product, builtins).get(section.groupKey) ?? [])].some(
            (held) => builtinIdentity(section.groupKey, held, builtins) === identity,
          ),
        )
        const values = countValues(inGroup, section.key, builtins).sort(mostFirst)
        const shown = section.limit === null ? values : values.slice(0, section.limit)
        return {
          title: group,
          collectionHandle: entry.handle,
          url: fieldUrl(entry.handle, { [section.groupKey]: [group] }),
          children: shown.map(({ value }) =>
            leaf(value, entry.handle, fieldUrl(entry.handle, { [section.groupKey]: [group], [section.key]: [value] })),
          ),
        }
      })
    }
    return titled(section.links.map((link) => linkItem(entry, link)))
  }

  // The parser guarantees every menu entry names a handle the file declares.
  const menu = structure.menu.flatMap((entry): ShopifyMenuItem[] => {
    const title =
      entry.type === 'category' ? categories.get(entry.handle)?.name : collectionsByHandle.get(entry.handle)?.name
    if (title === undefined) return []
    if (entry.sections.length === 0 && !entry.footer) {
      const item = categoryItems.get(entry.handle)
      if (entry.type === 'category') return item ? [item] : []
      return [{ title, collectionHandle: entry.handle, url: null, children: [] }]
    }
    const children = [
      ...entry.sections.flatMap((section) => sectionItems(entry, section)).filter((item) => item.children.length > 0),
      ...(entry.footer ?? []).map((link) => linkItem(entry, link)),
    ]
    return [{ title, collectionHandle: entry.handle, url: null, children }]
  })

  // The vendor and type campos are the product's built-in Vendor and Product type, which have no metafield definition.
  const metafields = structure.metafields.flatMap(({ name, key, source }): ShopifyMetafieldDefinition[] =>
    source === 'metafield' ? [{ name, namespace: 'custom', key, type: 'list.single_line_text_field' }] : [],
  )
  const filters = structure.metafields
    .filter((metafield) => metafield.filterable)
    .map(
      ({ name, key, source }): ShopifyFilter =>
        source === 'metafield' ? { name, source: 'metafield', metafield: `custom.${key}` } : { name, source },
    )

  return { metafields, filters, collections, menu }
}

/** A product's field values by key: its metafields, its Vendor and its Product type under their campos' keys. */
function fieldsOf(product: ManifestProduct, { vendorKey, typeKey }: BuiltinKeys): Map<string, Set<string>> {
  const fields = new Map(Object.entries(product.metafields).map(([field, held]) => [field, new Set(held)]))
  if (vendorKey && product.brand) fields.set(vendorKey, new Set([product.brand]))
  if (typeKey && product.type) fields.set(typeKey, new Set([product.type]))
  return fields
}

const caseInsensitive = ({ vendorKey, typeKey }: BuiltinKeys) =>
  new Set([vendorKey, typeKey].filter((key) => key !== undefined))

/** What two spellings of a value share: brands and Product types are one value whatever their case, as the store counts them. */
const builtinIdentity = (key: string, value: string, builtins: BuiltinKeys) =>
  caseInsensitive(builtins).has(key) ? value.toLowerCase() : value

/** Each value of `key` among `products`, under the first spelling met, with how many products hold it. */
function countValues(products: ManifestProduct[], key: string, builtins: BuiltinKeys): ValueCount[] {
  const counts = new Map<string, ValueCount>()
  for (const product of products) {
    for (const value of fieldsOf(product, builtins).get(key) ?? []) {
      const identity = builtinIdentity(key, value, builtins)
      const found = counts.get(identity) ?? { value, count: 0 }
      found.count += 1
      counts.set(identity, found)
    }
  }
  return [...counts.values()]
}

const alphabetically = (left: ValueCount, right: ValueCount) => left.value.localeCompare(right.value)

/** Most products first, then alphabetically, as the store orders a grouped section. */
const mostFirst = (left: ValueCount, right: ValueCount) => right.count - left.count || alphabetically(left, right)

/** The values of the option titled `title` the products offer, in a natural order: sizes 9, 10, 11. */
function offeredOptionValues(products: ManifestProduct[], title: string): string[] {
  const values = new Set(
    products.flatMap((product) => product.options.find((option) => option.title === title)?.values ?? []),
  )
  return [...values].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

/**
 * A Shopify collection matches all of its conditions or any of them. A rule whose keys each hold one
 * value is the first; a rule of one key with several values is the second. Anything else mixes the two.
 * The vendor campo is the product's Vendor, the "Proveedor" condition, and the type campo its Product
 * type, the "Tipo de producto" condition, rather than metafields.
 */
function toCollection(
  title: string,
  handle: string,
  groupingRule: ProductGroupingRuleDTO | null,
  { vendorKey, typeKey }: BuiltinKeys,
): ShopifyCollection {
  if (groupingRule === null) return { title, handle, rule: null }
  const rule = Object.entries(groupingRule).map(([key, values]) =>
    values.map(
      (value): ShopifyCollectionCondition =>
        key === vendorKey
          ? { field: 'vendor', value }
          : key === typeKey
            ? { field: 'type', value }
            : { metafield: `custom.${key}`, value },
    ),
  )

  if (rule.every((condition) => condition.length === 1)) {
    return { title, handle, rule: { applies: 'all', conditions: rule.flat() } }
  }
  const [condition, ...rest] = rule
  if (condition && rest.length === 0) {
    return { title, handle, rule: { applies: 'any', conditions: condition } }
  }

  const written = Object.entries(groupingRule)
    .map(([key, values]) => `${key}: [${values.join(', ')}]`)
    .join(', ')
  return {
    title,
    handle,
    rule: null,
    unsupported:
      `The rule { ${written} } mixes "all" and "any": a Shopify collection matches all of its conditions or any ` +
      'of them, never both. Give each key one value, or make the rule a single key with its alternatives.',
  }
}

if (import.meta.main) {
  const [, , file = DEFAULT_STRUCTURE_PATH, csvFile] = process.argv
  const { structure, errors } = parseCatalogStructure(await readFile(file, 'utf8'))
  if (!structure) {
    throw new Error(
      `${file} is not a valid structure file:\n${errors.map((error) => `  ${error.path}: ${error.message}`).join('\n')}`,
    )
  }
  // Only the products' Vendor, Type, options and metafields are read, so prices and the import's own checks do not matter here.
  const metafieldKeys = new Set(structure.metafields.map((metafield) => metafield.key))
  const products = csvFile
    ? (
        await parseShopifyCsv(
          createReadStream(csvFile),
          { overwrite: false, publish: false, defaultCurrency: null, marketCurrencies: {} },
          metafieldKeys,
        )
      ).products
    : undefined
  console.info(JSON.stringify(buildStructureManifest(structure, products), null, 2))
}
