import type {
  ProductCategoryTreeNodeDTO,
  ProductCollectionDTO,
  ProductFieldGroupDTO,
} from '@core/types/product/common.js'
import type {
  StoreNavigationEntryDTO,
  StoreNavigationLinkDTO,
  StoreNavigationSectionDTO,
} from '@core/types/store/common.js'
import { OPTION_FILTER_PREFIX } from '@core/utils/product-filter-key.js'

type TargetType = StoreNavigationEntryDTO['type']

type NavigationFilter = { key: string; value: string }

type NavigationLink = {
  label: string
  type: TargetType
  handle: string
  filters: NavigationFilter[]
}

type NavigationSection = {
  name: string
  display: 'list' | 'chips'
  links: NavigationLink[]
  viewAll: (Omit<NavigationLink, 'label'> & { label: string | null }) | null
  note: string | null
}

type NavigationEntry = {
  type: TargetType
  handle: string
  sections: NavigationSection[]
  footer: NavigationLink[]
}

/**
 * A section once the products are read: a `values` or `option` section with every value among the
 * entry's sellable products, a `groups` section with its groups, most products first.
 */
type ReadSectionDTO =
  | Exclude<StoreNavigationSectionDTO, { type: 'values' | 'option' | 'groups' }>
  | (Extract<StoreNavigationSectionDTO, { type: 'values' | 'option' }> & { values: string[] })
  | (Extract<StoreNavigationSectionDTO, { type: 'groups' }> & { read: ProductFieldGroupDTO[] })

/** A menu entry whose `values`, `option` and `groups` sections have been read. */
export type ReadNavigationEntryDTO = Omit<StoreNavigationEntryDTO, 'sections'> & { sections: ReadSectionDTO[] }

/**
 * The store's menu as the storefront renders it: each entry's sections resolved into columns of
 * links, each link a Category's or Collection's list by handle plus the field values it filters by.
 *
 * `subcategorias` are the entry's Visible children, closed by a "View all" of the entry's list.
 * `valores` are the values read for it cut at `limit`. A grouped `valores` becomes one column per
 * group, the first `groups` of them, each with its first `limit` values filtered by both fields and
 * closed by a "View all" of the group. An `opcion` section draws its values as chips, each filtering
 * the entry's list by that option. `enlaces` and the entry's `pie` are as written, a Category or
 * Collection link labelled by its own name unless the file names it.
 *
 * A link to a grouping that is not Visible is dropped, and so is a section left with no links, so
 * the panel never offers a dead end. The entries themselves are kept: the store skips one whose
 * handle names nothing Visible, as it does an entry without sections.
 */
export function buildStoreNavigation(
  navigation: ReadNavigationEntryDTO[],
  { categoryTree, collections }: { categoryTree: ProductCategoryTreeNodeDTO[]; collections: ProductCollectionDTO[] },
): NavigationEntry[] {
  return navigation.map((entry) => {
    const listLink = (label: string, filters: NavigationFilter[]): NavigationLink => ({
      label,
      ...target(entry),
      filters,
    })
    const column = (
      name: string,
      links: NavigationLink[],
      extra: Partial<Pick<NavigationSection, 'display' | 'viewAll' | 'note'>> = {},
    ): NavigationSection => ({ name, display: 'list', links, viewAll: null, note: null, ...extra })

    const toLink = (link: StoreNavigationLinkDTO): NavigationLink[] => {
      if (link.type === 'filter') {
        const filters = Object.entries(link.filter).flatMap(([key, values]) => values.map((value) => ({ key, value })))
        return [listLink(link.name, filters)]
      }
      const label =
        link.type === 'category'
          ? findCategory(categoryTree, link.handle)?.name
          : collections.find((collection) => collection.handle === link.handle)?.title
      if (label === undefined) return []
      return [{ label: link.name ?? label, type: link.type, handle: link.handle, filters: [] }]
    }

    const toColumns = (section: ReadSectionDTO): NavigationSection[] => {
      const note = { note: section.note ?? null }
      if (section.type === 'subcategories') {
        const children = findCategory(categoryTree, entry.handle)?.children ?? []
        const links = children.map(
          (child): NavigationLink => ({ label: child.name, type: 'category', handle: child.handle, filters: [] }),
        )
        return [column(section.name, links, { viewAll: { label: null, ...target(entry), filters: [] }, ...note })]
      }
      if (section.type === 'values') {
        const shown = section.limit === null ? section.values : section.values.slice(0, section.limit)
        const links = shown.map((value) => listLink(value, [{ key: section.key, value }]))
        return [column(section.name, links, note)]
      }
      if (section.type === 'option') {
        const key = `${OPTION_FILTER_PREFIX}${section.option}`
        const links = section.values.map((value) => listLink(value, [{ key, value }]))
        return [column(section.name, links, { display: 'chips', ...note })]
      }
      if (section.type === 'groups') {
        const groups = section.groups === null ? section.read : section.read.slice(0, section.groups)
        return groups.map((group, index) => {
          const groupFilter = { key: section.groupKey, value: group.value }
          const shown = section.limit === null ? group.values : group.values.slice(0, section.limit)
          const links = shown.map(({ value }) => listLink(value, [groupFilter, { key: section.key, value }]))
          // The note follows the last column, under the whole run of groups.
          const groupNote = index === groups.length - 1 ? note : {}
          return column(group.value, links, {
            viewAll: { label: group.value, ...target(entry), filters: [groupFilter] },
            ...groupNote,
          })
        })
      }
      return [column(section.name, section.links.flatMap(toLink), note)]
    }

    return {
      ...target(entry),
      sections: entry.sections.flatMap(toColumns).filter((section) => section.links.length > 0),
      footer: (entry.footer ?? []).flatMap(toLink),
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
