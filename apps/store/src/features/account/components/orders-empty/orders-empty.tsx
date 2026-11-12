import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { PackageIcon } from 'lucide-react'
import { ButtonLink } from '#/components/ui/button/button'
import {
  ordersEmpty,
  ordersEmptyAction,
  ordersEmptyIcon,
  ordersEmptyMessage,
  ordersEmptyMessageText,
  ordersEmptyPackage,
  ordersEmptyShopAll,
} from '#/features/account/components/orders-empty/orders-empty.variants'
import type { LinkTarget } from '#/lib/link-target'

/** The Orders panel before the first order: centred in whatever height the panel has. */
export function OrdersEmpty({ shopAllLink, className }: { shopAllLink: LinkTarget; className?: string }) {
  return (
    <div className={cn(ordersEmpty(), className)}>
      <PackageIcon className={cn(ordersEmptyIcon(), ordersEmptyPackage())} strokeWidth={1.5} />
      <div className={ordersEmptyMessage()}>
        <p className={ordersEmptyMessageText()}>
          <Trans>You haven't made any orders yet. When you make an order it'll show up here.</Trans>
        </p>
      </div>
      {/* One link, not the reference's gendered pair: there is no category taxonomy behind it. */}
      <div className={ordersEmptyAction()}>
        <ButtonLink {...shopAllLink} className={ordersEmptyShopAll()}>
          <Trans>Shop all products</Trans>
        </ButtonLink>
      </div>
    </div>
  )
}
