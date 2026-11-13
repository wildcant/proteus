import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import {
  shippingMethodNotice,
  shippingMethodNoticeMessage,
} from '#/features/checkout/components/shipping-method-notice/shipping-method-notice.variants'

/** Where the shipping methods will be, until there is an address to price them against. */
export function ShippingMethodNotice({ className }: { className?: string }) {
  return (
    <div className={cn(shippingMethodNotice(), className)}>
      <p className={cn(shippingMethodNoticeMessage(), 'm-0')}>
        <Trans>Enter your shipping address to view available shipping methods.</Trans>
      </p>
    </div>
  )
}
