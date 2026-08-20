const CART_ID_KEY = 'proteus_store_cart_id'

const hasLocalStorage = typeof localStorage !== 'undefined'

export function getCartId(): string | null {
  if (!hasLocalStorage) return null
  return localStorage.getItem(CART_ID_KEY)
}

export function setCartId(id: string): void {
  if (!hasLocalStorage) return
  localStorage.setItem(CART_ID_KEY, id)
}

export function clearCartId(): void {
  if (!hasLocalStorage) return
  localStorage.removeItem(CART_ID_KEY)
}
