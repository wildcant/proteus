import { Trans, useLingui } from '@lingui/react/macro'
import { usePrompt } from '@proteus/ui'
import { MoreVerticalIcon } from 'lucide-react'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { Button, ButtonLink } from '#/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/popover'
import { useDeleteAddress } from '#/features/address/api/addresses'

/**
 * Edit and delete, behind the row's own menu.
 *
 * A sibling of the label rather than inside it: a button nested in a `<label>` is a click the
 * browser forwards to the radio, so opening the menu would also select the row.
 */
export function AddressActions({ address }: { address: StoreCustomerAddress }) {
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
        render={<Button variant="ghost" size="icon" aria-label={t`Address options`} className="-mt-1 -mr-1 size-11" />}
      >
        <MoreVerticalIcon className="size-5" />
      </PopoverTrigger>
      <PopoverContent>
        <ButtonLink
          variant="ghost"
          to="/checkout/addresses/$addressId/edit"
          params={{ addressId: address.id }}
          className="h-10 w-full justify-start px-3 hover:bg-transparent dark:hover:bg-transparent"
        >
          <Trans>Edit address</Trans>
        </ButtonLink>
        <Button
          variant="ghost"
          onClick={confirmAndDelete}
          disabled={deleteAddress.isPending}
          className="h-10 w-full justify-start px-3 text-sale hover:bg-transparent hover:text-sale dark:hover:bg-transparent"
        >
          <Trans>Delete address</Trans>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
