import type {
  StoreNavigationEntry,
  StoreNavigationEntryType,
  StoreProductCategoryTreeNode,
  StoreProductCollection,
} from '#/api/generated/model'

/** Where a menu link goes: a Category's page or a Collection's, by handle. */
export type MenuTarget = { type: StoreNavigationEntryType; handle: string }

type MenuChild = { key: string; label: string; target: MenuTarget }

/** One top-level menu destination, with the child Categories a Category entry expands into. */
export type MenuItem = MenuChild & { children: MenuChild[] }

/**
 * What the menu is drawn from. `navigation` is the store's menu as the structure file set it, and
 * `collections` the Collections it names; the Category tree resolves its Category entries.
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
  if (navigation.length === 0) return categories.map(categoryItem)

  return navigation.flatMap((entry): MenuItem[] => {
    if (entry.type === 'category') {
      const found = findCategory(categories, entry.handle)
      return found ? [categoryItem(found)] : []
    }
    const found = collections.find((candidate) => candidate.handle === entry.handle)
    if (!found) return []
    return [{ key: found.id, label: found.title, target: { type: 'collection', handle: found.handle }, children: [] }]
  })
}

const categoryChild = ({ id, name, handle }: StoreProductCategoryTreeNode): MenuChild => ({
  key: id,
  label: name,
  target: { type: 'category', handle },
})

const categoryItem = (node: StoreProductCategoryTreeNode): MenuItem => ({
  ...categoryChild(node),
  children: node.children.map(categoryChild),
})

/** A menu may name a Category at any depth, so the search walks the whole Visible tree. */
function findCategory(nodes: StoreProductCategoryTreeNode[], handle: string): StoreProductCategoryTreeNode | undefined {
  for (const node of nodes) {
    if (node.handle === handle) return node
    const found = findCategory(node.children, handle)
    if (found) return found
  }
  return undefined
}
