import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { ChevronLeftIcon } from 'lucide-react'
import { ButtonLink } from '#/components/ui/button/button'
import { useSuspenseOrder } from '#/entities/order/api/orders'
import {
  orderContent,
  orderContentBack,
  orderContentDetails,
  orderContentHeader,
  orderContentPlaced,
  orderContentProgress,
  orderContentTitle,
  orderContentTitleGroup,
} from '#/features/orders/components/order-content/order-content.variants'
import { OrderDetails } from '#/features/orders/components/order-details/order-details'
import { OrderProgressTrack } from '#/features/orders/components/order-progress-track/order-progress-track'
import { useFormatters } from '#/hooks/use-formatters'
import type { LinkTarget } from '#/lib/link-target'

/**
 * A past order, opened from the account page. Deliberately not `/order/$orderId/confirmed`:
 * that page opens with "Thank you!", which is right the minute after checkout and wrong six
 * months later. Both render the same `OrderDetails` body under their own header.
 */
export function OrderContent({
  orderId,
  accountLink,
}: {
  orderId: string /** BACK_TO_ACCOUNT. */
  accountLink: LinkTarget
}) {
  const { order } = useSuspenseOrder(orderId)
  const { formatDate } = useFormatters()
  const { displayId } = order
  const placedAt = formatDate(order.createdAt)

  return (
    <main className={cn(orderContent(), 'mx-auto w-full')}>
      <div className={orderContentHeader()}>
        {/* `block` / `inline-flex`: the link sits on a text line, as the store renders it — the
            line's strut leaves 1.5px under it that the drawn flex column drops. The chevron is not
            drawn yet (Button has no icon slot at this size). */}
        <div className="block">
          <ButtonLink {...accountLink} variant="muted" className={cn(orderContentBack(), 'inline-flex')}>
            <ChevronLeftIcon />
            <Trans>Account</Trans>
          </ButtonLink>
        </div>

        {/* The word that was an eyebrow above the number is inside the heading now. A screen
            reader announced the old pair as "heading level one, number one", because the eyebrow
            was a separate paragraph and the number alone is not a name for anything. */}
        <div className={orderContentTitleGroup()}>
          <h1 className={orderContentTitle()}>
            <Trans>Order #{displayId}</Trans>
          </h1>
          <p className={orderContentPlaced()}>
            <Trans>Placed {placedAt}</Trans>
          </p>
        </div>

        {/* The status was the second half of the line above. It is the question this page is
            opened to answer, so it gets its own row and shows how far along it is. */}
        <OrderProgressTrack order={order} className={orderContentProgress()} />
      </div>

      <OrderDetails order={order} className={orderContentDetails()} />
    </main>
  )
}
