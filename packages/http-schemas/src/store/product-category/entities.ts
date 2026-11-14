import { z } from 'zod'

/**
 * A Visible Category with its Visible children nested, siblings in rank order. Only what the
 * storefront draws: the nav reads `name` and `handle`, the category page adds `heading` and
 * `description`.
 */
export const StoreProductCategoryTreeNode = z
  .object({
    id: z.string(),
    name: z.string(),
    /** The category page's heading, "Men's shoes" where the menu says "Men"; `null` shows `name`. */
    heading: z.string().nullable(),
    description: z.string(),
    handle: z.string(),
    get children(): z.ZodArray<typeof StoreProductCategoryTreeNode> {
      return z.array(StoreProductCategoryTreeNode)
    },
  })
  .openapi('StoreProductCategoryTreeNode')
export type StoreProductCategoryTreeNode = z.input<typeof StoreProductCategoryTreeNode>
