import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Button } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover/popover'
import {
  checkoutAccount,
  checkoutAccountAvatar,
  checkoutAccountEmail,
  checkoutAccountIdentity,
  checkoutAccountInitial,
  checkoutAccountOptions,
} from '#/features/checkout/components/checkout-account/checkout-account.variants'

type CheckoutAccountProps = {
  /** The cart's email, which for a signed-in shopper is the customer's: `carts/route.ts` copies it
   *  off the customer record when the cart is created, and `transfer-cart-customer.ts` when a guest
   *  cart is claimed. Read from the cart rather than from `/customers/me` deliberately — this is
   *  the address the order will be placed under, and those two can differ. */
  email: string | null
  /** Ends the session. Owned by the form hook, which has to clear the fields this row's owner
   *  filled before the token goes — see `useCheckoutForm`. */
  onSignOut: () => void
  className?: string
}

/**
 * Who is checking out, where a guest sees the Contact section. A signed-in shopper has already
 * given us their email, so this reads it back rather than asking again — and offers the one thing
 * they might be here to change: that it is the wrong account.
 */
export function CheckoutAccount({ email, onSignOut, className }: CheckoutAccountProps) {
  const { t } = useLingui()

  // Both paths that create a cart for a signed-in shopper set the email, so this is unreachable in
  // practice; if it ever is reached the order cannot be completed anyway — `validate-cart-email`
  // rejects it — and that message belongs in the Place order slot, not in a half-drawn header.
  if (!email) return null

  return (
    <div className={cn(checkoutAccount(), className)}>
      <div className={cn(checkoutAccountIdentity(), 'min-w-0')}>
        {/* Decorative: the email beside it already says whose account this is, so announcing the
            initial a second time would only add noise. */}
        <span aria-hidden="true" className={cn(checkoutAccountAvatar(), 'shrink-0')}>
          <span className={checkoutAccountInitial()}>{email.charAt(0)}</span>
        </span>
        <span className={cn(checkoutAccountEmail(), 'truncate')}>{email}</span>
      </div>

      <Popover>
        <PopoverTrigger
          render={
            // `-mr-2` pulls the 44px hit area into the gutter, which a drawing can't hold.
            <Button
              variant="ghost"
              size="icon"
              aria-label={t`Account options`}
              className={cn(checkoutAccountOptions(), '-mr-2')}
            />
          }
        >
          <Icon name="more-vertical" className="size-5" />
        </PopoverTrigger>
        <PopoverContent>
          {/* The open menu is not drawn for this row; it is AddressActions' look. */}
          <Button
            variant="ghost"
            onClick={onSignOut}
            className="h-10 w-full justify-start px-3 hover:bg-transparent dark:hover:bg-transparent"
          >
            <Trans>Sign out</Trans>
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
