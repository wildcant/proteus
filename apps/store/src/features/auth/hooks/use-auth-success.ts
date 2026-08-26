import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { AuthenticateResponse } from '#/api/generated/model'
import { useTransferCart } from '#/features/cart/api/cart'

export type AuthSuccessParams = {
  /** Where to land instead of /account — checkout passes its own path so a mid-checkout sign-in
   *  returns to the order being placed. */
  redirectTo?: string
}

/**
 * What happens after a successful sign-in or signup. Both entry points land in the same
 * two places — an unverified account has to check its email, a verified one goes to the
 * account page with its guest cart carried over — so the branch lives here rather than
 * being written out on each page.
 */
export function useAuthSuccess(params?: AuthSuccessParams) {
  const [isVerifyPending, setIsVerifyPending] = useState(false)
  const navigate = useNavigate()
  const transferCart = useTransferCart()

  const handleSuccess = (data: AuthenticateResponse) => {
    if (data.verificationRequired) {
      setIsVerifyPending(true)
      return
    }
    // Transfer guest cart to the newly authenticated customer. Failure must not block sign-in.
    transferCart.mutate(undefined, {
      onSettled: () => navigate({ to: params?.redirectTo ?? '/account' }),
    })
  }

  return { isVerifyPending, handleSuccess }
}
