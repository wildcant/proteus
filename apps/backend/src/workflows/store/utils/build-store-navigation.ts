import type { ProductCategoryTreeNodeDTO, ProductCollectionDTO } from '@core/types/product/common.js'
import type { StoreNavigationEntryDTO, StoreNavigationSectionDTO } from '@core/types/store/common.js'

type TargetType = StoreNavigationEntryDTO['type']

type NavigationLink = {
  label: string
  type: TargetType
  handle: string
  filters: { key: string; value: string }[]
}

type NavigationEntry = {
  type: TargetType
  handle: string
  sections: { name: string; links: NavigationLink[] }[]
}

/** A `values` section once its values are read: every distinct one among the entry's sellable products, sorted. */
type ReadSectionDTO =
  | Exclude<StoreNavigationSectionDTO, { type: 'values' }>
  | (Extract<StoreNavigationSectionDTO, { type: 'values' }> & { values: string[] })

/** A menu entry whose `values` sections have been read. */
export type ReadNavigationEntryDTO = Omit<StoreNavigationEntryDTO, 'sections'> & { sections: ReadSectionDTO[] }

/**
 * The store's menu as the storefront renders it: each entry's sections resolved into links, each a
 * Category's or Collection's list by handle plus the field values it filters by.
 *
 * `subcategorias` are the entry's Visible children, `valores` the values read for it cut at `limit`,
 * and `enlaces` as written, a Category or Collection link labelled by its own name unless the file
 * names it. A link to a grouping that is not Visible is dropped, and so is a section left with no
 * links, so the panel never offers a dead end. The entries themselves are kept: the store skips one
 * whose handle names nothing Visible, as it does an entry without sections.
 */
export function buildStoreNavigation(
  navigation: ReadNavigationEntryDTO[],
  { categoryTree, collections }: { categoryTree: ProductCategoryTreeNodeDTO[]; collections: ProductCollectionDTO[] },
): NavigationEntry[] {
  return navigation.map((entry) => {
    const toLinks = (section: ReadSectionDTO): NavigationLink[] => {
      const listLink = (label: string, filters: NavigationLink['filters']) => ({ label, ...target(entry), filters })
      if (section.type === 'subcategories') {
        const category = findCategory(categoryTree, entry.handle)
        return (category?.children ?? []).map(
          (child): NavigationLink => ({
            label: child.name,
            type: 'category',
            handle: child.handle,
            filters: [],
          }),
        )
      }
      if (section.type === 'values') {
        const shown = section.limit === null ? section.values : section.values.slice(0, section.limit)
        return shown.map((value) => listLink(value, [{ key: section.key, value }]))
      }
      return section.links.flatMap((link): NavigationLink[] => {
        if (link.type === 'filter') {
          const filters = Object.entries(link.filter).flatMap(([key, values]) =>
            values.map((value) => ({ key, value })),
          )
          return [listLink(link.name, filters)]
        }
        const label =
          link.type === 'category'
            ? findCategory(categoryTree, link.handle)?.name
            : collections.find((collection) => collection.handle === link.handle)?.title
        if (label === undefined) return []
        return [{ label: link.name ?? label, type: link.type, handle: link.handle, filters: [] }]
      })
    }

    return {
      ...target(entry),
      sections: entry.sections
        .map((section) => ({ name: section.name, links: toLinks(section) }))
        .filter((section) => section.links.length > 0),
    }
  })
}

const target = ({ type, handle }: { type: TargetType; handle: string }) => ({ type, handle })

/** A menu may name a Category at any depth, so the search walks the whole Visible tree. */
function findCategory(nodes: ProductCategoryTreeNodeDTO[], handle: string): ProductCategoryTreeNodeDTO | undefined {
  for (const node of nodes) {
    if (node.handle === handle) return node
    const found = findCategory(node.children, handle)
    if (found) return found
  }
  return undefined
}
