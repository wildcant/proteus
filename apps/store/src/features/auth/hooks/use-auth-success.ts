import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { AuthenticateResponse } from '#/api/generated/model'
import { useTransferCart } from '#/features/cart/api/cart'

/**
 * What happens after a successful sign-in or signup. Both entry points land in the same
 * two places — an unverified account has to check its email, a verified one goes to the
 * account page with its guest cart carried over — so the branch lives here rather than
 * being written out on each page.
 */
export function useAuthSuccess() {
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
      onSettled: () => navigate({ to: '/account' }),
    })
  }

  return { isVerifyPending, handleSuccess }
}
