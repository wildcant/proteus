import { z } from 'zod'

/**
 * One entry of the store's menu, by handle: a Category, shown with its children, or a Collection.
 * A handle that names no visible Category or Collection is the store's to skip.
 */
export const StoreNavigationEntry = z
  .object({ type: z.enum(['category', 'collection']), handle: z.string() })
  .openapi('StoreNavigationEntry')
export type StoreNavigationEntry = z.input<typeof StoreNavigationEntry>
