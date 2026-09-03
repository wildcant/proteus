import { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import type { Confirm } from './types'

/**
 * What the shopper decided about their wallet, registered from inside the selector and read from
 * outside it.
 *
 * The selector owns the rows, so it owns the selection; the place-order press is above the whole
 * payment step and has to be told. Registering it here rather than lifting the state into the
 * checkout form keeps "which card" a fact about the payment step: nothing in the form, the
 * schema, or the submit sequence gains a field it would then have to keep in step with the list.
 */
export type WalletChoice = {
  /** `null` means the new-method form, which is what a guest and an empty wallet always mean. */
  chosenMethodId: string | null
  /** Consent to keep the card, gated on the session rather than on how many cards are stored. */
  saveMethod: boolean
  /**
   * The chosen card is gone: refetch the wallet and drop the selection back to the new-method
   * form. Offering the shopper the same dead card to press again is the worst of the options.
   */
  resetForStaleMethod: () => void
}

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
  /** The mounted selector's wallet choice, or `null` when no selector is mounted. */
  wallet: () => WalletChoice | null
  registerWallet: (choice: WalletChoice | null) => void
}

export function usePaymentController(): PaymentController {
  const confirmRef = useRef<Confirm | null>(null)
  const walletRef = useRef<WalletChoice | null>(null)

  const register = useCallback((confirm: Confirm | null) => {
    confirmRef.current = confirm
  }, [])
  const current = useCallback(() => confirmRef.current, [])

  const registerWallet = useCallback((choice: WalletChoice | null) => {
    walletRef.current = choice
  }, [])
  const wallet = useCallback(() => walletRef.current, [])

  return useMemo(() => ({ current, register, wallet, registerWallet }), [current, register, wallet, registerWallet])
}

const PaymentControllerContext = createContext<PaymentController | null>(null)

export const PaymentControllerProvider = PaymentControllerContext.Provider

export function usePaymentControllerContext(): PaymentController {
  const controller = useContext(PaymentControllerContext)
  if (!controller) throw new Error('The payment step must be rendered inside a PaymentControllerProvider')
  return controller
}
