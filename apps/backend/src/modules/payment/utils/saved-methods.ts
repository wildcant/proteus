import type { SavedMethodDTO } from '../../../core/types/payment/common.js'

/**
 * The wallet's order: the default first, then most recently stored.
 *
 * Defined once, applied once — by the module, over the merged list — because the checkout
 * selector and the account page are two views of one wallet and must not each hold an opinion
 * about it. A shopper whose account page and checkout disagree about which card is first has
 * been given two wallets.
 *
 * Ties on `createdAt` keep the order the gateway returned them in, which is stable per gateway
 * and is the only tiebreak available that does not invent one.
 */
export function orderSavedMethods(methods: SavedMethodDTO[]): SavedMethodDTO[] {
  return [...methods].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}
