import { useContext } from 'react'
import { RouteModalProviderContext } from './route-modal-context'

/**
 * Access the route modal context (`handleSuccess`, `setCloseOnEscape`).
 *
 * - `handleSuccess(path?)` — navigates after a successful save, setting
 *   `isSubmitSuccessful` in history state so `RouteModalForm`'s blocker
 *   lets the navigation through.
 * - `setCloseOnEscape(boolean)` — toggle Escape-to-close behavior (disable
 *   when inline editing e.g. DataGrid cells inside the modal).
 */
export const useRouteModal = () => {
  const context = useContext(RouteModalProviderContext)
  if (!context) {
    throw new Error('useRouteModal must be used within a RouteModalProvider')
  }
  return context
}
