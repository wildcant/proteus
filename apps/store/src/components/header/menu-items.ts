import type {
  StoreNavigationEntry,
  StoreNavigationEntryType,
  StoreNavigationLink,
  StoreProductCategoryTreeNode,
  StoreProductCollection,
} from '#/api/generated/model'

/**
 * Where a menu link goes: a Category's page or a Collection's, by handle, narrowed by `filter` — the
 * list's own `filter` param, `<key>:<value>` — when the link carries field values.
 */
export type MenuTarget = { type: StoreNavigationEntryType; handle: string; filter?: string[] }

type MenuChild = { key: string; label: string; target: MenuTarget }

/** One titled column of a menu entry's panel. */
export type MenuSection = { key: string; title: string; links: MenuChild[] }

/**
 * One top-level menu destination. An entry the structure file gave `secciones` opens those; any
 * other Category expands into its child Categories.
 */
export type MenuItem = MenuChild & { children: MenuChild[]; sections: MenuSection[] }

/**
 * What the menu is drawn from. `navigation` is the store's menu as the structure file set it, its
 * sections already resolved, and `collections` the Collections it names; the Category tree resolves
 * its Category entries.
 */
export type MenuSource = {
  categories: StoreProductCategoryTreeNode[]
  navigation: StoreNavigationEntry[]
  collections: StoreProductCollection[]
}

/**
 * The store's menu, in its order. An entry whose handle names nothing Visible is skipped rather
 * than linked to a not-found page. A store with no menu lists every top-level Visible Category, so
 * one that never applied a structure file still has its catalogue on the menu.
 */
export function resolveMenuItems({ categories, navigation, collections }: MenuSource): MenuItem[] {
  if (navigation.length === 0) return categories.map((node) => categoryItem(node, []))

  return navigation.flatMap((entry): MenuItem[] => {
    const sections = entry.sections.map(
      (section, index): MenuSection => ({
        key: `${entry.type}:${entry.handle}:${index}`,
        title: section.name,
        links: section.links.map(sectionLink),
      }),
    )
    if (entry.type === 'category') {
      const found = findCategory(categories, entry.handle)
      return found ? [categoryItem(found, sections)] : []
    }
    const found = collections.find((candidate) => candidate.handle === entry.handle)
    if (!found) return []
    return [
      {
        key: found.id,
        label: found.title,
        target: { type: 'collection', handle: found.handle },
        children: [],
        sections,
      },
    ]
  })
}

const categoryChild = ({ id, name, handle }: StoreProductCategoryTreeNode): MenuChild => ({
  key: id,
  label: name,
  target: { type: 'category', handle },
})

/** Sections replace the children: the file's columns are the whole panel, `subcategorias` among them. */
const categoryItem = (node: StoreProductCategoryTreeNode, sections: MenuSection[]): MenuItem => ({
  ...categoryChild(node),
  children: sections.length > 0 ? [] : node.children.map(categoryChild),
  sections,
})

const sectionLink = ({ label, type, handle, filters }: StoreNavigationLink): MenuChild => {
  const filter = filters.map(({ key, value }) => `${key}:${value}`)
  return {
    key: `${type}:${handle}:${label}:${filter.join('&')}`,
    label,
    target: filter.length > 0 ? { type, handle, filter } : { type, handle },
  }
}

/** A menu may name a Category at any depth, so the search walks the whole Visible tree. */
function findCategory(nodes: StoreProductCategoryTreeNode[], handle: string): StoreProductCategoryTreeNode | undefined {
  for (const node of nodes) {
    if (node.handle === handle) return node
    const found = findCategory(node.children, handle)
    if (found) return found
  }
  return undefined
}
