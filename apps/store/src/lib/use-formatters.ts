import { formatPrice } from '@proteus/ui'
import { formatDate, formatDatetime } from '@proteus/utils'
import { useMemo } from 'react'
import { useMarket } from '#/lib/use-market'

type DateInput = string | number | Date

/**
 * The shared formatters, already told which market they are formatting for.
 *
 * A hook rather than the market's locale code threaded through every call site: each component
 * swaps one import for one hook call, and a site that is missed fails the lint rather than
 * quietly rendering `COP 100,000` at a Colombian shopper forever. The helpers themselves keep
 * their American default, which is what leaves the admin's call sites untouched.
 *
 * Only what the storefront renders. `formatAmount`, `getCurrencySymbol` and `formatRelativeTime`
 * are admin-only today, and a wrapper with no caller is a wrapper nobody keeps correct.
 */
export function useFormatters() {
  const { current } = useMarket()

  return useMemo(
    () => ({
      formatPrice: (amount: string, currencyCode: string) => formatPrice(amount, currencyCode, current.localeCode),
      formatDate: (date: DateInput) => formatDate(date, current.localeCode),
      formatDatetime: (date: DateInput) => formatDatetime(date, current.localeCode),
    }),
    [current.localeCode],
  )
}
