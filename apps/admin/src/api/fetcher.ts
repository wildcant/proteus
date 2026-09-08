import qs from 'qs'
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
    target.search = qs.stringify(params, { skipNulls: true })
  }

  const token = getToken()
  const baseHeaders: Record<string, string> = {}
  if (token) {
    baseHeaders.Authorization = `Bearer ${token}`
  }

  const init: RequestInit = { method }
  if (data instanceof FormData) {
    // Content-Type is dropped on purpose: only the browser can append the multipart
    // boundary, and it only does so when the header is absent.
    const { 'Content-Type': _contentType, ...forwardedHeaders } = headers ?? {}
    init.headers = { ...baseHeaders, ...forwardedHeaders }
    init.body = data
  } else if (data) {
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
      window.location.href = '/login'
    }

    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? `${method} ${url} failed: ${response.status}`)
  }

  if ([204, 205, 304].includes(response.status)) return {} as T
  return response.json()
}

export type ErrorType<E> = E
export type BodyType<B> = B
