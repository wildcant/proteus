import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  authResetPassword,
  authUpdatePassword,
  authVerificationConfirm,
  storeAuthLogin,
  storeAuthSignup,
} from '#/api/generated/auth/auth'
import type {
  AuthenticateResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  StoreLoginBody,
  StoreSignupBody,
  UpdatePasswordResponse,
  VerificationConfirmResponse,
} from '#/api/generated/model'
import { clearToken, setToken } from '#/lib/auth-token'
import { clearCartId } from '#/lib/cart-id'

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

export const useVerifyEmail = (options?: UseMutationOptions<VerificationConfirmResponse, Error, { code: string }>) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (payload: { code: string }) => authVerificationConfirm(payload),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to verify email', description: error.message })
      onError?.(...args)
    },
  })
}

export const useLogout = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return () => {
    clearToken()
    clearCartId()
    queryClient.resetQueries()
    navigate({ to: '/' })
  }
}
