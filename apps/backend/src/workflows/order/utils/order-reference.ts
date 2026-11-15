import { ORDER_REFERENCE_PREFIX } from '@proteus/store-config'

/**
 * What the shop and the shopper quote an Order by: the store's reference prefix followed by the
 * display id («ORD-1042»), or the bare display id when the store sets no prefix.
 */
export function orderReference(displayId: number, prefix: string | undefined = ORDER_REFERENCE_PREFIX): string {
  return `${prefix ?? ''}${displayId}`
}
