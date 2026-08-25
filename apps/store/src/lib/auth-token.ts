const TOKEN_KEY = 'proteus_store_token'

const hasLocalStorage = typeof localStorage !== 'undefined'

export function getToken(): string | null {
  if (!hasLocalStorage) return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (!hasLocalStorage) return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  if (!hasLocalStorage) return
  localStorage.removeItem(TOKEN_KEY)
}

export function isGuest(): boolean {
  return !getToken()
}

/**
 * Whether the token looks like a registered customer, i.e. has a non-empty actorId.
 *
 * NOT A SECURITY CHECK: the signature is never verified. Use it only to skip requests and
 * routes that cannot succeed. Signup issues a valid token with an empty actorId, which
 * customer-scoped endpoints reject — and the fetcher clears the token on any 401 outside
 * `/auth/`, which would kill the session mid-verification.
 */
export function isRegistered(): boolean {
  const token = getToken()
  const payload = token?.split('.')[1]
  if (!payload) return false
  try {
    const decoded: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof decoded !== 'object' || decoded === null) return false
    const { actorId } = decoded as { actorId?: unknown }
    return typeof actorId === 'string' && actorId.length > 0
  } catch {
    return false
  }
}
