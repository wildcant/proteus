import { z } from 'zod'
import { StoreNavigationEntry } from './entities.js'

/** The store's menu, in order. Empty until a structure file is applied. */
export const StoreNavigationResponse = z
  .object({ navigation: z.array(StoreNavigationEntry) })
  .openapi('StoreNavigationResponse')
export type StoreNavigationResponse = z.input<typeof StoreNavigationResponse>
