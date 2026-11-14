import { z } from 'zod'
import { StoreNavigationEntry, StoreSearch } from './entities.js'

/** The store's menu, in order, and what search offers. Both empty until a structure file is applied. */
export const StoreNavigationResponse = z
  .object({ navigation: z.array(StoreNavigationEntry), search: StoreSearch })
  .openapi('StoreNavigationResponse')
export type StoreNavigationResponse = z.input<typeof StoreNavigationResponse>
