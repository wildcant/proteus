import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { authResetPassword, authUpdatePassword, storeAuthLogin, storeAuthSignup } from '#/api/generated/auth/auth'
import type {
  AuthenticateResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  StoreLoginBody,
  StoreSignupBody,
  UpdatePasswordResponse,
} from '#/api/generated/model'
import { clearToken, setToken } from '#/lib/auth-token'

export const useLogin = (options?: UseMutationOptions<AuthenticateResponse, Error, StoreLoginBody>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (payload: StoreLoginBody) => storeAuthLogin(payload),
    onSuccess: (...args) => {
      const [data] = args
      setToken(data.token)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Login failed', description: error.message })
      onError?.(...args)
    },
  })
}

export const useRegister = (options?: UseMutationOptions<AuthenticateResponse, Error, StoreSignupBody>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (payload: StoreSignupBody) => storeAuthSignup(payload),
    onSuccess: (...args) => {
      const [data] = args
      setToken(data.token)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Registration failed', description: error.message })
      onError?.(...args)
    },
  })
}

export const useRequestPasswordReset = (
  options?: UseMutationOptions<ResetPasswordResponse, Error, ResetPasswordBody>,
) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (payload: ResetPasswordBody) => authResetPassword('customer', 'emailpass', payload),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to request password reset', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdatePassword = (
  options?: UseMutationOptions<UpdatePasswordResponse, Error, { password: string; token: string }>,
) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: ({ password, token }: { password: string; token: string }) => {
      setToken(token)
      return authUpdatePassword('customer', 'emailpass', { password }).finally(() => clearToken())
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update password', description: error.message })
      onError?.(...args)
    },
  })
}

export type LogoutParams = {
  /** Where to land instead of the home page — checkout passes its own path, so signing out of the
   *  wrong account does not also throw away the order being placed. Must be a route a guest can
   *  reach: the navigation happens after the token is gone. */
  redirectTo?: string
}

export const useLogout = (params?: LogoutParams) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return () => {
    // The cart id outlives the session on purpose: signing out ends the session, not the shop.
    // Store cart routes are unauthenticated, so the cart stays readable and the shopper keeps
    // what they had. See the detach TODO in .tasks/next-todos for what this costs.
    clearToken()
    queryClient.resetQueries()
    navigate({ to: params?.redirectTo ?? '/' })
  }
}
