import { MoreVerticalIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/popover'

type CheckoutAccountProps = {
  /** The cart's email, which for a signed-in shopper is the customer's: `carts/route.ts` copies it
   *  off the customer record when the cart is created, and `transfer-cart-customer.ts` when a guest
   *  cart is claimed. Read from the cart rather than from `/customers/me` deliberately — this is
   *  the address the order will be placed under, and those two can differ. */
  email: string | null
  /** Ends the session. Owned by the form hook, which has to clear the fields this row's owner
   *  filled before the token goes — see `useCheckoutForm`. */
  onSignOut: () => void
}

/**
 * Who is checking out, where a guest sees the Contact section. A signed-in shopper has already
 * given us their email, so this reads it back rather than asking again — and offers the one thing
 * they might be here to change: that it is the wrong account.
 */
export function CheckoutAccount({ email, onSignOut }: CheckoutAccountProps) {
  // Both paths that create a cart for a signed-in shopper set the email, so this is unreachable in
  // practice; if it ever is reached the order cannot be completed anyway — `validate-cart-email`
  // rejects it — and that message belongs in the Place order slot, not in a half-drawn header.
  if (!email) return null

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {/* Decorative: the email beside it already says whose account this is, so announcing the
            initial a second time would only add noise. */}
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-subtle font-medium text-ink text-sm uppercase"
        >
          {email.charAt(0)}
        </span>
        <span className="truncate text-ink text-sm">{email}</span>
      </div>

      <Popover>
        <PopoverTrigger
          render={<Button variant="ghost" size="icon" aria-label="Account options" className="-mr-2 size-11" />}
        >
          <MoreVerticalIcon className="size-5" />
        </PopoverTrigger>
        <PopoverContent>
          <Button
            variant="ghost"
            onClick={onSignOut}
            className="h-10 w-full justify-start px-3 hover:bg-transparent dark:hover:bg-transparent"
          >
            Sign out
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
