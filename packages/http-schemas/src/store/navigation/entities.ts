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

/** One column of a menu entry's panel: its title and links, ready to render. A section left with no links is not served. */
export const StoreNavigationSection = z
  .object({ name: z.string(), links: z.array(StoreNavigationLink) })
  .openapi('StoreNavigationSection')
export type StoreNavigationSection = z.input<typeof StoreNavigationSection>

/**
 * One entry of the store's menu, by handle: a Category or a Collection. With no `sections` a Category
 * is shown with its children; with them, the entry opens a panel of those sections. A handle that
 * names no visible Category or Collection is the store's to skip.
 */
export const StoreNavigationEntry = z
  .object({ type: StoreNavigationTargetType, handle: z.string(), sections: z.array(StoreNavigationSection) })
  .openapi('StoreNavigationEntry')
export type StoreNavigationEntry = z.input<typeof StoreNavigationEntry>
