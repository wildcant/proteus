import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui-core'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { authUpdatePassword, authVerificationConfirm, storeAuthLogin, storeAuthSignup } from '#/api/generated/auth/auth'
import type {
  AuthenticateResponse,
  StoreLoginBody,
  StoreSignupBody,
  UpdatePasswordResponse,
} from '#/api/generated/model'
import { clearToken, setToken } from '#/lib/auth-token'

export const useLogin = (options?: UseMutationOptions<AuthenticateResponse, Error, StoreLoginBody>) => {
  const { t } = useLingui()
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
      toast.add({ type: 'error', title: t`Login failed`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useRegister = (options?: UseMutationOptions<AuthenticateResponse, Error, StoreSignupBody>) => {
  const { t } = useLingui()
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
      toast.add({ type: 'error', title: t`Registration failed`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdatePassword = (
  options?: UseMutationOptions<UpdatePasswordResponse, Error, { password: string; token: string }>,
) => {
  const { t } = useLingui()
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: ({ password, token }: { password: string; token: string }) => {
      setToken(token)
      return authUpdatePassword('customer', 'emailpass', { password }).finally(() => clearToken())
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update password`, description: error.message })
      onError?.(...args)
    },
  })
}

/** What confirming a code can turn out to be. Both arms render; neither is a fault. */
export type VerificationOutcome = { verified: true } | { verified: false; message?: string }

/**
 * Confirms an emailed verification code, answering with the outcome rather than raising.
 *
 * A refusal here is the ordinary case — a code that has expired, or that a first visit already
 * spent — and it is something the page renders, not something that went wrong. Thrown, it would
 * fall through to the route's `errorComponent`, which tells the shopper their link is malformed.
 * That is a different story and usually the wrong one, so the refusal is returned as an outcome
 * and only the route decides how to word it.
 *
 * A plain function rather than a mutation hook because the code is single-use: its caller is a
 * route loader, which the router runs once per navigation outside React's render and effect cycle,
 * so a StrictMode remount cannot spend the code twice.
 */
export const confirmVerification = async (code: string): Promise<VerificationOutcome> => {
  try {
    await authVerificationConfirm({ code })
    return { verified: true }
  } catch (error) {
    return { verified: false, message: error instanceof Error ? error.message : undefined }
  }
}
