import { z } from 'zod'

/** What a collection page draws: the hero's title and thumbnail, and the handle it is reached by. */
export const StoreProductCollection = z
  .object({
    id: z.string(),
    title: z.string(),
    handle: z.string(),
    thumbnail: z.string().nullable(),
  })
  .openapi('StoreProductCollection')
export type StoreProductCollection = z.input<typeof StoreProductCollection>
