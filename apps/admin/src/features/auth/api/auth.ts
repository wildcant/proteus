import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { authAuthenticate } from '#/api/generated/auth/auth'
import type { AuthenticateResponse } from '#/api/generated/model'
import { getMe, updateMe } from '#/api/generated/users/users'
import { clearToken, setToken } from '#/lib/auth-token'
import { forgetLocale, rememberLocale } from '#/lib/i18n/locale'
import { queryKeysFactory } from '#/lib/query-key-factory'

const AUTH_QUERY_KEY = 'auth' as const
const authQueryKeys = queryKeysFactory(AUTH_QUERY_KEY)

export const meQueryOptions = () =>
  queryOptions({
    queryKey: authQueryKeys.detail('me'),
    queryFn: () => getMe(),
  })

export const useMe = () => {
  const { data, ...rest } = useQuery(meQueryOptions())
  return { ...data, ...rest }
}

export const useLogout = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return () => {
    clearToken()
    forgetLocale()
    queryClient.clear()
    navigate({ to: '/login' })
  }
}

/**
 * Saves the staff member's own Locale, then reloads: the catalog is loaded once, before the router,
 * so the new language takes over the whole page at once rather than one query at a time.
 */
export const useUpdateLocale = () =>
  useMutation({
    mutationFn: (locale: string) => updateMe({ locale }),
    onSuccess: ({ user }) => {
      rememberLocale(user.locale)
      window.location.reload()
    },
  })

type LoginPayload = { email: string; password: string }

export const useLogin = (options?: UseMutationOptions<AuthenticateResponse, Error, LoginPayload>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (payload: LoginPayload) => authAuthenticate('user', 'emailpass', payload),
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
