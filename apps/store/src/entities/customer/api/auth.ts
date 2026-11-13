import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui-core'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { authResetPassword } from '#/api/generated/auth/auth'
import type { ResetPasswordBody, ResetPasswordResponse } from '#/api/generated/model'
import { clearToken } from '#/lib/auth-token'
import type { LinkTarget } from '#/lib/link-target'

export const useRequestPasswordReset = (
  options?: UseMutationOptions<ResetPasswordResponse, Error, ResetPasswordBody>,
) => {
  const { t } = useLingui()
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (payload: ResetPasswordBody) => authResetPassword('customer', 'emailpass', payload),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to request password reset`, description: error.message })
      onError?.(...args)
    },
  })
}

export type LogoutParams = {
  /** SIGN_OUT, from the route: the home page, or checkout's own page, so signing out of the wrong account does not
   *  also throw away the order being placed. Must be a page a guest can reach: the navigation happens after the token
   *  is gone. */
  signedOut: LinkTarget
}

export const useLogout = ({ signedOut }: LogoutParams) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return () => {
    // The cart id outlives the session on purpose: signing out ends the session, not the shop.
    // Store cart routes are unauthenticated, so the cart stays readable and the shopper keeps
    // what they had. See the detach TODO in .tasks/next-todos for what this costs.
    clearToken()
    queryClient.resetQueries()
    navigate(signedOut)
  }
}
