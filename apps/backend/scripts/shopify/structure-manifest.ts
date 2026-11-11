import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CatalogStructureCategoryDTO,
  CatalogStructureDTO,
  ProductGroupingRuleDTO,
} from '../../src/core/types/product/common.js'
import { parseCatalogStructure } from '../../src/modules/product/utils/catalog-structure/parse-catalog-structure.js'

/**
 * Turns a structure file into what the Shopify admin needs: one automated collection per Category
 * and Collection, and the nested main menu. The `shopify-sync` skill applies it.
 *
 *   pnpm --filter backend exec tsx scripts/shopify/structure-manifest.ts [estructura.yaml]
 *
 * Prints the manifest as JSON; with no path it reads the seed `catalog-structure.yaml`.
 */

/** Shopify's "Etiqueta" condition list, matched on all conditions or on any of them. */
type ShopifyCollectionRule = { applies: 'all' | 'any'; tags: string[] }

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

type ShopifyMenuItem = { title: string; collectionHandle: string; children: ShopifyMenuItem[] }

type ShopifyStructureManifest = { collections: ShopifyCollection[]; menu: ShopifyMenuItem[] }

const DEFAULT_STRUCTURE_PATH = path.join(import.meta.dirname, '../seed/catalog-structure.yaml')

/**
 * A Category's collection is titled with its ancestors (`Men › Tops`) because sibling trees reuse
 * names, and the menu's link picker finds a collection by title. Its menu item keeps the plain name.
 */
export function buildStructureManifest(structure: CatalogStructureDTO): ShopifyStructureManifest {
  const collections: ShopifyCollection[] = []
  const categoryItems = new Map<string, ShopifyMenuItem>()

  const visit = (category: CatalogStructureCategoryDTO, ancestors: string[]): ShopifyMenuItem => {
    const titles = [...ancestors, category.name]
    collections.push(toCollection(titles.join(' › '), category.handle, category.rule))
    const item = {
      title: category.name,
      collectionHandle: category.handle,
      children: category.children.map((child) => visit(child, titles)),
    }
    categoryItems.set(category.handle, item)
    return item
  }
  for (const category of structure.categories) visit(category, [])

  const collectionTitles = new Map<string, string>()
  for (const collection of structure.collections) {
    collections.push(toCollection(collection.name, collection.handle, collection.rule))
    collectionTitles.set(collection.handle, collection.name)
  }

  // The parser guarantees every menu entry names a handle the file declares.
  const menu = structure.menu.flatMap((entry): ShopifyMenuItem[] => {
    if (entry.type === 'category') {
      const item = categoryItems.get(entry.handle)
      return item ? [item] : []
    }
    const title = collectionTitles.get(entry.handle)
    return title === undefined ? [] : [{ title, collectionHandle: entry.handle, children: [] }]
  })

  return { collections, menu }
}

/**
 * Shopify takes either all-of single tags or any-of tags. Every condition holding one tag is the
 * first; a single condition of several tags is the second. Anything else mixes the two.
 */
function toCollection(title: string, handle: string, rule: ProductGroupingRuleDTO | null): ShopifyCollection {
  if (rule === null) return { title, handle, rule: null }

  if (rule.every((condition) => condition.length === 1)) {
    return { title, handle, rule: { applies: 'all', tags: [...new Set(rule.flat())] } }
  }
  const [condition, ...rest] = rule
  if (condition && rest.length === 0) {
    return { title, handle, rule: { applies: 'any', tags: [...new Set(condition)] } }
  }

  const written = `[${rule.map((group) => `[${group.join(', ')}]`).join(', ')}]`
  return {
    title,
    handle,
    rule: null,
    unsupported:
      `The rule ${written} mixes "all" and "any": a Shopify collection matches all of its conditions or any of ` +
      'them, never both. Tag the products so each condition is one tag, or make it a single list of alternatives.',
  }
}

if (import.meta.main) {
  const file = process.argv[2] ?? DEFAULT_STRUCTURE_PATH
  const { structure, errors } = parseCatalogStructure(await readFile(file, 'utf8'))
  if (!structure) {
    throw new Error(
      `${file} is not a valid structure file:\n${errors.map((error) => `  ${error.path}: ${error.message}`).join('\n')}`,
    )
  }
  console.info(JSON.stringify(buildStructureManifest(structure), null, 2))
}
