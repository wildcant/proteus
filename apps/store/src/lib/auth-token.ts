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
