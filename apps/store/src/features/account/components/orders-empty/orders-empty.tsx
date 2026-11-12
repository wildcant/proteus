import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { ButtonLink } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import {
  ordersEmpty,
  ordersEmptyAction,
  ordersEmptyIcon,
  ordersEmptyMessage,
  ordersEmptyMessageText,
  ordersEmptyPackage,
  ordersEmptyShopAll,
} from '#/features/account/components/orders-empty/orders-empty.variants'

/** The Orders panel before the first order: centred in whatever height the panel has. */
export function OrdersEmpty({ className }: { className?: string }) {
  return (
    <div className={cn(ordersEmpty(), className)}>
      <Icon name="package" className={cn(ordersEmptyIcon(), ordersEmptyPackage())} strokeWidth={1.5} />
      <div className={ordersEmptyMessage()}>
        <p className={ordersEmptyMessageText()}>
          <Trans>You haven't made any orders yet. When you make an order it'll show up here.</Trans>
        </p>
      </div>
      {/* One link, not the reference's gendered pair: there is no category taxonomy behind it. */}
      <div className={ordersEmptyAction()}>
        <ButtonLink to="/" className={ordersEmptyShopAll()}>
          <Trans>Shop all products</Trans>
        </ButtonLink>
      </div>
    </div>
  )
}
