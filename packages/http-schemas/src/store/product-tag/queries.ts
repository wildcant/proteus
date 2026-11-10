import { z } from 'zod'

/**
 * The scope of the product list the chips sit above: the keys `GET /store/products` takes, minus
 * `tag`. The values offered are the ones the list shows before any Tag is chosen.
 */
export const StoreProductTagValueListParams = z.object({
  q: z.string().optional(),
  /** A Category's handle, widened to its Visible descendants as on the product list. */
  category: z.string().min(1).optional(),
  /** A Collection's handle. */
  collection: z.string().min(1).optional(),
})
export type StoreProductTagValueListQuery = z.infer<typeof StoreProductTagValueListParams>
