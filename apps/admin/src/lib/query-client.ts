import { focusManager, QueryClient } from '@tanstack/react-query'

/**
 * React Query listens for `visibilitychange` alone, which a browser fires when a tab is hidden and
 * never when the window merely loses focus to another application. The sidebar is rebuilt from the
 * permissions `/me` returns, so coming back from another window has to count as returning.
 */
focusManager.setEventListener((handleFocus) => {
  const onFocus = () => handleFocus(true)
  const onBlur = () => handleFocus(false)
  const onVisibilityChange = () => handleFocus(document.visibilityState === 'visible')

  window.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)

  return () => {
    window.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('blur', onBlur)
  }
})

/**
 * `staleTime` stays at React Query's default of 0, so a mount, a refocus or a reconnect refetches.
 * Admin data moves under the person reading it — stock, reservations, fulfillment and roles all
 * change from elsewhere — so a cached number that looks authoritative is worse than a request. Data
 * that is reference rather than operational (countries, regions, currencies) sets its own
 * `staleTime` on the query — see REFERENCE_DATA_STALE_TIME below.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
})

/**
 * For reference data: the ISO country table, the regions every selector reads, and the store's
 * currency list. These move only when someone edits them here, and every mutation that edits one
 * invalidates its key — so the freshness this trades away is another operator's change arriving
 * late, not this operator reading their own stale write. Stock, orders and reservations are not
 * reference data and keep the 0 above.
 */
export const REFERENCE_DATA_STALE_TIME = 5 * 60_000
