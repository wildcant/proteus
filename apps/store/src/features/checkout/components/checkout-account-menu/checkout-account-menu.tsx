import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Button } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover/popover'
import {
  checkoutAccountMenu,
  checkoutAccountMenuItems,
  checkoutAccountMenuMenu,
  checkoutAccountMenuSignOut,
  checkoutAccountMenuSignOutLabel,
} from '#/features/checkout/components/checkout-account-menu/checkout-account-menu.variants'

/**
 * The menu's row is drawn as a plain frame; here it is a ghost Button for the focus ring, so the
 * Button's centring and hover fill are undone and the row fills the menu.
 */
const MENU_ROW = 'w-full justify-start hover:bg-transparent'

/**
 * Sign out, behind the account row's options button. The set draws the open menu; `className` is
 * the options trigger, the part the account row places.
 */
export function CheckoutAccountMenu({ onSignOut, className }: { onSignOut: () => void; className?: string }) {
  const { t } = useLingui()

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label={t`Account options`} className={className} />}
      >
        <Icon name="more-vertical" className="size-5" />
      </PopoverTrigger>
      {/* `static`: the instance's `relative` would place the arrow from inside the popup's border,
          1px off the Popover's own (unpositioned) placement. */}
      <PopoverContent className={cn(checkoutAccountMenu(), checkoutAccountMenuMenu(), 'static')}>
        <div className={checkoutAccountMenuItems()}>
          <Button
            variant="ghost"
            onClick={onSignOut}
            className={cn(checkoutAccountMenuSignOut(), checkoutAccountMenuSignOutLabel(), MENU_ROW)}
          >
            <Trans>Sign out</Trans>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
