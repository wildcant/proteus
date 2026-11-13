import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { ButtonLink } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import {
  cartEmpty,
  cartEmptyAction,
  cartEmptyBag,
  cartEmptyBody,
  cartEmptyDescription,
  cartEmptyIcon,
  cartEmptyText,
  cartEmptyTitle,
} from '#/features/cart/components/cart-empty/cart-empty.variants'
import type { LinkTarget } from '#/lib/link-target'

/**
 * The panel's empty state. The link needs no `onClick`: a plain `<Link>` drops the search params,
 * and `modal` is one of them, so navigating away is closing the panel.
 */
export function CartEmpty({ browseLink }: { browseLink: LinkTarget }) {
  return (
    // `flex-1`: it fills the panel below the header, which the design draws as its own frame.
    <div className={cn(cartEmpty(), 'flex-1')}>
      <Icon name="shopping-bag" className={cn(cartEmptyIcon(), cartEmptyBag())} />
      <div className={cartEmptyBody()}>
        <div className={cartEmptyText()}>
          <h2 className={cn(cartEmptyTitle(), 'm-0')}>
            <Trans>Your bag is empty</Trans>
          </h2>
          <p className={cn(cartEmptyDescription(), 'm-0')}>
            <Trans>There are no products in your bag</Trans>
          </p>
        </div>
        <ButtonLink {...browseLink} className={cn(cartEmptyAction(), 'w-full')}>
          <Trans>Browse products</Trans>
        </ButtonLink>
      </div>
    </div>
  )
}
