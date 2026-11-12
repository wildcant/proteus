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
import type { StoreNavigationEntryDTO, StoreNavigationSectionDTO } from '../../src/core/types/store/common.js'
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
 * `valores` section needs the product CSV: Shopify menus are static, so the values are read off the
 * CSV's products and written out as menu items.
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
 * metafield (`custom.genero`), or the built-in Vendor, which the app lists as "Brand".
 */
type ShopifyFilter = { name: string; source: 'metafield'; metafield: string } | { name: string; source: 'vendor' }

/**
 * One collection condition: the product's `metafield` (`custom.genero`) list holds `value`, or its
 * Vendor (`field: 'vendor'`, "Proveedor es igual a") is `value`.
 */
type ShopifyCollectionCondition = { metafield: string; value: string } | { field: 'vendor'; value: string }

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

/** What a `valores` section reads of a CSV product. */
type ManifestProduct = Pick<ImportedProductDTO, 'brand' | 'metafields'>

const DEFAULT_STRUCTURE_PATH = path.join(import.meta.dirname, '../seed/catalog-structure.yaml')

/**
 * A Category's collection is titled with its ancestors (`Men › Tops`) because sibling trees reuse
 * names, and the menu's link picker finds a collection by title. Its menu item keeps the plain name.
 *
 * A menu entry with sections gets one child per section, holding that section's links, so the tree
 * stays within Shopify's three levels (Hombre › Marcas › Nike). `products` are the CSV's, which a
 * `valores` section reads its values from; it is required only when the menu has one.
 */
export function buildStructureManifest(
  structure: CatalogStructureDTO,
  products?: ManifestProduct[],
): ShopifyStructureManifest {
  const vendorKey = structure.metafields.find((metafield) => metafield.source === 'vendor')?.key
  const collections: ShopifyCollection[] = []
  const categoryItems = new Map<string, ShopifyMenuItem>()
  const categories = new Map<string, CatalogStructureCategoryDTO>()

  const visit = (category: CatalogStructureCategoryDTO, ancestors: string[]): ShopifyMenuItem => {
    const titles = [...ancestors, category.name]
    collections.push(toCollection(titles.join(' › '), category.handle, category.rule, vendorKey))
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
    collections.push(toCollection(collection.name, collection.handle, collection.rule, vendorKey))
  }

  const fieldUrl = (handle: string, filter: Record<string, string[]>) => {
    const params = Object.entries(filter).flatMap(([key, values]) =>
      values.map((value) => {
        const name = key === vendorKey ? 'filter.p.vendor' : `filter.p.m.custom.${key}`
        return `${name}=${encodeURIComponent(value)}`
      }),
    )
    return `/collections/${handle}?${params.join('&')}`
  }

  const sectionItems = (entry: StoreNavigationEntryDTO, section: StoreNavigationSectionDTO): ShopifyMenuItem[] => {
    const leaf = (title: string, collectionHandle: string, url: string | null = null) => ({
      title,
      collectionHandle,
      url,
      children: [],
    })
    if (section.type === 'subcategories') {
      // Their own children would be a fourth level.
      return (categories.get(entry.handle)?.children ?? []).map((child) => leaf(child.name, child.handle))
    }
    if (section.type === 'values') {
      if (!products) {
        throw new Error(
          `The menu entry "${entry.handle}" lists the values of "${section.key}": pass the product CSV to read them from.`,
        )
      }
      const rule =
        entry.type === 'category' ? categories.get(entry.handle)?.rule : collectionsByHandle.get(entry.handle)?.rule
      const values = distinctValues(products, section.key, rule ?? null, vendorKey)
      const shown = section.limit === null ? values : values.slice(0, section.limit)
      return shown.map((value) => leaf(value, entry.handle, fieldUrl(entry.handle, { [section.key]: [value] })))
    }
    return section.links.map((link) => {
      if (link.type === 'filter') return leaf(link.name, entry.handle, fieldUrl(entry.handle, link.filter))
      // The parser guarantees the handle names a grouping the file declares.
      const name =
        link.type === 'category' ? categories.get(link.handle)?.name : collectionsByHandle.get(link.handle)?.name
      return leaf(link.name ?? name ?? link.handle, link.handle)
    })
  }

  // The parser guarantees every menu entry names a handle the file declares.
  const menu = structure.menu.flatMap((entry): ShopifyMenuItem[] => {
    const title =
      entry.type === 'category' ? categories.get(entry.handle)?.name : collectionsByHandle.get(entry.handle)?.name
    if (title === undefined) return []
    if (entry.sections.length === 0) {
      const item = categoryItems.get(entry.handle)
      if (entry.type === 'category') return item ? [item] : []
      return [{ title, collectionHandle: entry.handle, url: null, children: [] }]
    }
    const children = entry.sections
      .map((section) => ({
        title: section.name,
        collectionHandle: entry.handle,
        url: null,
        children: sectionItems(entry, section),
      }))
      .filter((section) => section.children.length > 0)
    return [{ title, collectionHandle: entry.handle, url: null, children }]
  })

  // The vendor campo is the product's built-in Vendor, which has no metafield definition.
  const metafields = structure.metafields.flatMap(({ name, key, source }): ShopifyMetafieldDefinition[] =>
    source === 'vendor' ? [] : [{ name, namespace: 'custom', key, type: 'list.single_line_text_field' }],
  )
  const filters = structure.metafields
    .filter((metafield) => metafield.filterable)
    .map(
      ({ name, key, source }): ShopifyFilter =>
        source === 'vendor' ? { name, source: 'vendor' } : { name, source: 'metafield', metafield: `custom.${key}` },
    )

  return { metafields, filters, collections, menu }
}

/**
 * The distinct values of `key` among the products `rule` matches, sorted. Brands that differ only
 * in case are one value under the first spelling met, as the store counts them.
 */
function distinctValues(
  products: ManifestProduct[],
  key: string,
  rule: ProductGroupingRuleDTO | null,
  vendorKey: string | undefined,
): string[] {
  const values = new Map<string, string>()
  for (const product of products) {
    const fields = new Map(Object.entries(product.metafields).map(([field, held]) => [field, new Set(held)]))
    if (vendorKey && product.brand) fields.set(vendorKey, new Set([product.brand]))
    // A manual grouping's members are picked in the admin, so the CSV cannot say which they are.
    if (!rule || !matchesGroupingRule(rule, fields, vendorKey)) continue
    for (const value of fields.get(key) ?? []) {
      const identity = key === vendorKey ? value.toLowerCase() : value
      if (!values.has(identity)) values.set(identity, value)
    }
  }
  return [...values.values()].sort((left, right) => left.localeCompare(right))
}

/**
 * A Shopify collection matches all of its conditions or any of them. A rule whose keys each hold one
 * value is the first; a rule of one key with several values is the second. Anything else mixes the two.
 * The vendor campo is the product's Vendor, the "Proveedor" condition, rather than a metafield.
 */
function toCollection(
  title: string,
  handle: string,
  groupingRule: ProductGroupingRuleDTO | null,
  vendorKey: string | undefined,
): ShopifyCollection {
  if (groupingRule === null) return { title, handle, rule: null }
  const rule = Object.entries(groupingRule).map(([key, values]) =>
    values.map(
      (value): ShopifyCollectionCondition =>
        key === vendorKey ? { field: 'vendor', value } : { metafield: `custom.${key}`, value },
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
  // Only the products' Vendor and metafields are read, so prices and the import's own checks do not matter here.
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
