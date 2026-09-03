import { useCallback } from 'react'
import { useCreatePaymentCollection, useCreatePaymentSession, useRepricePaymentSession } from '../api/checkout'
import type { CreateSession } from './types'

/**
 * Opens the payment session, and is the only thing in the payment step that talks to our API.
 *
 * It is handed to the adapter rather than called by it, which is what makes deferred creation a
 * property of the checkout: an adapter cannot open a session earlier than the place-order press
 * even if it wanted to, because it has no other way to open one.
 *
 * The three calls, in this order and for these reasons:
 *
 * 1. **Create the collection.** Priced from the cart, server-side. If the shopper has pressed
 *    Place order before — a declined card, a retry — the workflow returns the collection that
 *    already exists, at the total it was created with.
 * 2. **Open the session.** The gateway's intent is created here and nowhere earlier.
 * 3. **Re-price it.** Which fixes exactly case 1: a reused collection can predate a cart change.
 *    It costs one round trip to our own server and no gateway call when the amount is unchanged,
 *    and it is what makes "the amount charged is the total at the moment Place order was pressed"
 *    true on the retry path as well as the first press. The browser sends no amount — it names
 *    the two ids and is told what the cart came to.
 */
export function useOpenPaymentSession(cartId: string) {
  const createCollection = useCreatePaymentCollection()
  const createSession = useCreatePaymentSession()
  const repriceSession = useRepricePaymentSession()

  const open = useCallback<(providerId: string) => CreateSession>(
    (providerId) => async (providerData) => {
      const { paymentCollection } = await createCollection.mutateAsync({ cartId })
      const { paymentSession } = await createSession.mutateAsync({
        collectionId: paymentCollection.id,
        providerId,
        data: providerData,
      })
      const repriced = await repriceSession.mutateAsync({
        collectionId: paymentCollection.id,
        sessionId: paymentSession.id,
      })

      return {
        data: repriced.paymentSession.data,
        amount: repriced.paymentSession.amount,
        currencyCode: repriced.paymentSession.currencyCode,
      }
    },
    [cartId, createCollection, createSession, repriceSession],
  )

  return {
    open,
    isPending: createCollection.isPending || createSession.isPending || repriceSession.isPending,
  }
}
