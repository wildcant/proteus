import { clearToken } from './auth-token'
import { forgetLocale } from './i18n/locale'

/**
 * Ends the staff session and boots a fresh login page. A full page load, not a router navigation:
 * the catalog and `<html lang>` are set once per load, so only a reload hands the login page back to
 * the browser's language.
 */
export function signOut(): void {
  clearToken()
  forgetLocale()
  window.location.href = '/login'
}
