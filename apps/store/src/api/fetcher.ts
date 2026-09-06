import { env } from '#/env'
import { clearToken, getToken } from '#/lib/auth-token'

/**
 * A refusal from our own API, with the two things a caller can branch on.
 *
 * The body already carries `{ code, type, message }` — the code is an authored constant, never a
 * third party's string — and throwing a bare `Error` threw all of that away but the message. That
 * left the only way to recognise, say, a stale saved card as matching on copy, which breaks the
 * first time someone rewords it. `message` is unchanged, so every existing `error.message` toast
 * reads exactly as it did.
 */
export class ApiError extends Error {
  readonly status: number
  /** The API's own code for this refusal, or `unknown_error` when the body carried none. */
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * The refusal, read off the body where there is one.
 *
 * `no_json_body` is not filler: a 500 carrying our own envelope came from our server, and one with
 * an unparseable body came from something in front of it — a proxy, a load balancer. They are
 * different things to go and look at, and without the distinction the two log identically.
 */
async function apiErrorFor(response: Response, request: string): Promise<ApiError> {
  const body: { message?: string; code?: string } | null = await response.json().catch(() => null)
  if (!body) return new ApiError(`${request} failed: ${response.status}`, response.status, 'no_json_body')

  return new ApiError(
    body.message ?? `${request} failed: ${response.status}`,
    response.status,
    body.code ?? 'unknown_error',
  )
}

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
