import { useEffect, useRef, useState } from 'react'
import type { StoreCartLineItem } from '#/api/generated/model'
import { useRemoveLineItem, useUpdateLineItem } from '#/features/cart/api/cart'
import { useDebounce } from '#/hooks/use-debounce'

/** Long enough to swallow a burst of taps, short enough that the total does not feel stuck. */
const QUANTITY_DEBOUNCE_MS = 400

/**
 * The quantity on one cart line: what the shopper sees, when it reaches the server, and what
 * happens at zero. Safe to debounce because the endpoint takes an absolute quantity, so last write wins.
 */
export function useLineItemQuantity(item: StoreCartLineItem) {
  // Every write to one line runs in order. Without it a PATCH(4) still in flight can resolve after
  // a PATCH(5) sent 400ms later, and the refetch that follows lands on the wrong number.
  const scope = { id: `cart-line-item-${item.id}` }

  const updateLineItem = useUpdateLineItem({ scope, onError: () => setDraft(null) })
  const removeLineItem = useRemoveLineItem({ scope })

  // The unsent value, or null when nothing is unsent. Falling back to `item.quantity` avoids
  // having to decide, on every cart re-render, whether the server or the shopper is more current.
  const [draft, setDraft] = useState<number | null>(null)
  const quantity = draft ?? item.quantity

  // Released when the refetched cart agrees, not when the mutation resolves: `item.quantity` is
  // still stale until the GET lands, so clearing on resolve flashed the old value for a round-trip.
  useEffect(() => {
    if (draft !== null && item.quantity === draft) setDraft(null)
  }, [draft, item.quantity])

  const send = () => {
    if (draft === null || draft === item.quantity) return
    updateLineItem.mutate({ lineId: item.id, quantity: draft })
  }

  // `useDebounce` arms on mount too, so the guard above is what stops a PATCH per row on open.
  const [, cancelPending] = useDebounce(send, QUANTITY_DEBOUNCE_MS, [draft])

  // `useDebounce` cancels on unmount, and the row unmounts on the way to `/checkout` — without a
  // flush the shopper is charged for the quantity they just changed away from.
  const flush = useRef(send)
  const isRemoved = useRef(false)
  useEffect(() => {
    flush.current = send
  })
  useEffect(() => {
    return () => {
      if (!isRemoved.current) flush.current()
    }
  }, [])

  return {
    quantity,
    setQuantity: setDraft,
    /** Cancels the pending write rather than flushing it, so it cannot race the DELETE. */
    remove: () => {
      cancelPending()
      isRemoved.current = true
      setDraft(null)
      removeLineItem.mutate(item.id)
    },
    isRemoving: removeLineItem.isPending,
  }
}
