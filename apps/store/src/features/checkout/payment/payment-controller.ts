import { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import type { Confirm } from './types'

/**
 * The bridge between the place-order button and the adapter that can confirm.
 *
 * `useConfirm` has to be called inside the adapter's `Root` — that is where the gateway's SDK
 * context lives — while the button that awaits it sits above the whole payment step. A ref
 * registered from inside and read from outside is what joins them, and it keeps the checkout free
 * of any knowledge of which adapter is mounted.
 */
export type PaymentController = {
  /** The mounted adapter's confirm, or `null` when no adapter is mounted. */
  current: () => Confirm | null
  register: (confirm: Confirm | null) => void
}

export function usePaymentController(): PaymentController {
  const confirmRef = useRef<Confirm | null>(null)
  const register = useCallback((confirm: Confirm | null) => {
    confirmRef.current = confirm
  }, [])
  const current = useCallback(() => confirmRef.current, [])

  return useMemo(() => ({ current, register }), [current, register])
}

const PaymentControllerContext = createContext<PaymentController | null>(null)

export const PaymentControllerProvider = PaymentControllerContext.Provider

export function usePaymentControllerContext(): PaymentController {
  const controller = useContext(PaymentControllerContext)
  if (!controller) throw new Error('The payment step must be rendered inside a PaymentControllerProvider')
  return controller
}
