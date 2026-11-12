import { z } from 'zod'

const StoreNavigationTargetType = z.enum(['category', 'collection'])

/** One field value a menu link filters its list by, as the list's `filter` param spells it: `<key>:<value>`. */
export const StoreNavigationFilter = z.object({ key: z.string(), value: z.string() }).openapi('StoreNavigationFilter')

/**
 * One link of a menu section: a Category's or Collection's list by handle, narrowed by `filters`
 * (values of one key widen, keys narrow). An unfiltered link has none.
 */
export const StoreNavigationLink = z
  .object({
    label: z.string(),
    type: StoreNavigationTargetType,
    handle: z.string(),
    filters: z.array(StoreNavigationFilter),
  })
  .openapi('StoreNavigationLink')
export type StoreNavigationLink = z.input<typeof StoreNavigationLink>

/**
 * Where a column's "View all" goes: the whole of what the column lists, e.g. the entry's list, or the
 * entry's list filtered by one brand. `label` names it when it is narrower than the entry ("Adidas");
 * null when it is the entry's list itself.
 */
export const StoreNavigationViewAll = z
  .object({
    label: z.string().nullable(),
    type: StoreNavigationTargetType,
    handle: z.string(),
    filters: z.array(StoreNavigationFilter),
  })
  .openapi('StoreNavigationViewAll')

/**
 * One column of a menu entry's panel: its title and links, ready to render. `display` is how the links
 * are drawn: `chips` for an option's values (sizes), `list` for everything else. `viewAll` closes the
 * column with a link to the whole of it, and `note` is a short text shown under its links. A section
 * left with no links is not served.
 */
export const StoreNavigationSection = z
  .object({
    name: z.string(),
    display: z.enum(['list', 'chips']),
    links: z.array(StoreNavigationLink),
    viewAll: StoreNavigationViewAll.nullable(),
    note: z.string().nullable(),
  })
  .openapi('StoreNavigationSection')
export type StoreNavigationSection = z.input<typeof StoreNavigationSection>

/**
 * One entry of the store's menu, by handle: a Category or a Collection. With no `sections` a Category
 * is shown with its children; with them, the entry opens a panel of those sections, and `footer`
 * holds the links set apart below them. A handle that names no visible Category or Collection is the
 * store's to skip.
 */
export const StoreNavigationEntry = z
  .object({
    type: StoreNavigationTargetType,
    handle: z.string(),
    sections: z.array(StoreNavigationSection),
    footer: z.array(StoreNavigationLink),
  })
  .openapi('StoreNavigationEntry')
export type StoreNavigationEntry = z.input<typeof StoreNavigationEntry>
