import { useMe } from '#/features/auth/api/auth'
import { useSuspenseDraftOrder } from '#/features/draft-orders/api/draft-orders'
import { draftActions } from '#/features/draft-orders/utils/draft-actions'

/** The draft detail page: the draft, and what this admin may do to it. */
export function useDraftOrderData(id: string) {
  const { data } = useSuspenseDraftOrder(id)
  const { allowedActions } = useMe()

  const draftOrder = data.draftOrder
  const actions = draftActions(draftOrder.status, allowedActions ?? [])

  return { draftOrder, actions }
}

export type DraftOrderData = ReturnType<typeof useDraftOrderData>
