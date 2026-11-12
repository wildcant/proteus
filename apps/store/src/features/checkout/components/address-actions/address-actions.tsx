import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { MoreVerticalIcon } from 'lucide-react'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { Button, ButtonLink } from '#/components/ui/button/button'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover/popover'
import { usePrompt } from '#/components/ui/prompt/prompt'
import { useDeleteAddress } from '#/entities/address/api/addresses'
import {
  addressActions,
  addressActionsDelete,
  addressActionsDeleteLabel,
  addressActionsEdit,
  addressActionsEditLabel,
  addressActionsItems,
  addressActionsMenu,
} from '#/features/checkout/components/address-actions/address-actions.variants'
import type { LinkTarget } from '#/lib/link-target'

/**
 * The menu's rows are drawn as plain frames; here they are ghost Buttons for the focus ring, so
 * the Button's centring and hover fill are undone and the row fills the menu.
 */
const MENU_ROW = 'w-full justify-start hover:bg-transparent dark:hover:bg-transparent'

/**
 * Edit and delete, behind the row's own menu. The set draws the open menu; `className` is the
 * row's options trigger, the part the picker places.
 *
 * A sibling of the label rather than inside it: a button nested in a `<label>` is a click the
 * browser forwards to the radio, so opening the menu would also select the row.
 */
export function AddressActions({
  address,
  editLink,
  className,
}: {
  address: StoreCustomerAddress
  /** EDIT_ADDRESS. */
  editLink: LinkTarget
  className?: string
}) {
  const { t } = useLingui()
  const prompt = usePrompt()
  const deleteAddress = useDeleteAddress()
  const label = address.addressName || address.address1 || t`this address`

  // Delete goes through a confirmation: a one-tap destructive action on the row the order is
  // about to ship to is a mis-tap waiting to happen.
  const confirmAndDelete = async () => {
    const confirmed = await prompt({
      title: t`Remove this address?`,
      description: t`${label} will be removed from your address book. This cannot be undone.`,
      confirmText: t`Remove`,
      cancelText: t`Cancel`,
    })

    if (!confirmed) return

    deleteAddress.mutate(address.id)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          // The negative margins pull the 44px hit area into the row's padding.
          <Button
            variant="ghost"
            size="icon"
            aria-label={t`Address options`}
            className={cn(className, '-mt-1 -mr-1')}
          />
        }
      >
        <MoreVerticalIcon className="size-5" />
      </PopoverTrigger>
      {/* `static`: the instance's `relative` would place the arrow from inside the popup's border,
          1px off the Popover's own (unpositioned) placement. */}
      <PopoverContent className={cn(addressActions(), addressActionsMenu(), 'static')}>
        <div className={addressActionsItems()}>
          <ButtonLink
            {...editLink}
            variant="ghost"
            className={cn(addressActionsEdit(), addressActionsEditLabel(), MENU_ROW)}
          >
            <Trans>Edit address</Trans>
          </ButtonLink>
          <Button
            variant="ghost"
            onClick={confirmAndDelete}
            disabled={deleteAddress.isPending}
            className={cn(addressActionsDelete(), addressActionsDeleteLabel(), MENU_ROW)}
          >
            <Trans>Delete address</Trans>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
