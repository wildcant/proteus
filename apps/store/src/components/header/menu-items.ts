import type {
  StoreNavigationEntry,
  StoreNavigationEntryType,
  StoreNavigationLink,
  StoreNavigationSection,
  StoreProductCategoryTreeNode,
  StoreProductCollection,
} from '#/api/generated/model'

/**
 * Where a menu link goes: a Category's page or a Collection's, by handle, narrowed by `filter` — the
 * list's own `filter` param, `<key>:<value>` — when the link carries field values.
 */
export type MenuTarget = { type: StoreNavigationEntryType; handle: string; filter?: string[] }

type MenuChild = { key: string; label: string; target: MenuTarget }

/**
 * One titled column of a menu entry's panel. `display` is how its links are drawn — `chips` for
 * sizes — and `viewAll` closes it with a link to the whole of it, `name` naming what that is when it
 * is narrower than the entry ("Adidas"). `note` is a short text shown under the links.
 */
export type MenuSection = {
  key: string
  title: string
  display: StoreNavigationSection['display']
  links: MenuChild[]
  viewAll: { key: string; name: string | null; target: MenuTarget } | null
  note: string | null
}

/**
 * One top-level menu destination. An entry the structure file gave `secciones` opens those, with its
 * `footer` links set apart below them; any other Category expands into its child Categories.
 */
export type MenuItem = MenuChild & { children: MenuChild[]; sections: MenuSection[]; footer: MenuChild[] }

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
  if (navigation.length === 0) return categories.map((node) => categoryItem(node, [], []))

  return navigation.flatMap((entry): MenuItem[] => {
    const sections = entry.sections.map((section, index): MenuSection => {
      const key = `${entry.type}:${entry.handle}:${index}`
      const { viewAll } = section
      return {
        key,
        title: section.name,
        display: section.display,
        links: section.links.map(sectionLink),
        viewAll: viewAll ? { key: `${key}:all`, name: viewAll.label, target: targetOf(viewAll) } : null,
        note: section.note,
      }
    })
    const footer = entry.footer.map(sectionLink)
    if (entry.type === 'category') {
      const found = findCategory(categories, entry.handle)
      return found ? [categoryItem(found, sections, footer)] : []
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
        footer,
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
const categoryItem = (node: StoreProductCategoryTreeNode, sections: MenuSection[], footer: MenuChild[]): MenuItem => ({
  ...categoryChild(node),
  children: sections.length > 0 ? [] : node.children.map(categoryChild),
  sections,
  footer,
})

/** A link's list, by handle, with its field values as the list's own `filter` param. */
const targetOf = ({ type, handle, filters }: Omit<StoreNavigationLink, 'label'>): MenuTarget => {
  const filter = filters.map(({ key, value }) => `${key}:${value}`)
  return filter.length > 0 ? { type, handle, filter } : { type, handle }
}

const sectionLink = (link: StoreNavigationLink): MenuChild => {
  const target = targetOf(link)
  return {
    key: `${link.type}:${link.handle}:${link.label}:${target.filter?.join('&') ?? ''}`,
    label: link.label,
    target,
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
