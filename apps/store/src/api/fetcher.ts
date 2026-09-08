import { apiErrorFor } from '#/api/api-error'
import { env } from '#/env'
import { clearToken, getToken } from '#/lib/auth-token'

export const fetcher = async <T>({
  url,
  method,
  params,
  data,
  headers,
  signal,
}: {
  url: string
  method: string
  params?: Record<string, unknown> | undefined
  data?: unknown
  headers?: Record<string, string> | undefined
  signal?: AbortSignal | undefined
}): Promise<T> => {
  const target = new URL(url, env.VITE_BACKEND_URL)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) {
        for (const v of value) {
          target.searchParams.append(key, String(v))
        }
      } else {
        target.searchParams.append(key, String(value))
      }
    }
  }

  const token = getToken()
  const baseHeaders: Record<string, string> = {}
  if (token) {
    baseHeaders.Authorization = `Bearer ${token}`
  }

  const init: RequestInit = { method }
  if (data) {
    init.headers = { ...baseHeaders, 'Content-Type': 'application/json', ...headers }
    init.body = JSON.stringify(data)
  } else {
    init.headers = { ...baseHeaders, ...headers }
  }
  if (signal) init.signal = signal

  const response = await fetch(target, init)

  if (!response.ok) {
    if (response.status === 401 && !url.startsWith('/auth/')) {
      clearToken()
    }

    throw await apiErrorFor(response, `${method} ${url}`)
  }

  if ([204, 205, 304].includes(response.status)) return {} as T
  return response.json()
}

export type ErrorType<E> = E
export type BodyType<B> = B
