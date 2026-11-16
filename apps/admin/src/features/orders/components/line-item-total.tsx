import { formatPrice } from '@proteus/utils'
import BigNumber from 'bignumber.js'
import type { AdminOrderLineItem } from '#/api/generated/model'
import { activeLocale } from '#/lib/i18n/locale'

type LineItemTotalProps = {
  item: Pick<AdminOrderLineItem, 'compareAtUnitPrice' | 'quantity' | 'lineTotal'>
  currency: string
}

/**
 * A line's total, with the compare-at for the whole quantity struck beside it when the line was
 * marked down. Struck at the line rather than the unit so it reads against the figure it is
 * compared with, at quantity one as at ten.
 */
export function LineItemTotal({ item, currency }: LineItemTotalProps) {
  return (
    <span className="flex shrink-0 items-baseline gap-x-2 text-sm tabular-nums">
      {item.compareAtUnitPrice !== null && (
        <span className="text-muted-foreground line-through">
          {formatPrice(new BigNumber(item.compareAtUnitPrice).times(item.quantity).toFixed(), currency, activeLocale())}
        </span>
      )}
      <span className="font-medium">{formatPrice(item.lineTotal, currency, activeLocale())}</span>
    </span>
  )
}
