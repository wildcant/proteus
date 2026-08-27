import { usePrompt } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { MoreVerticalIcon } from 'lucide-react'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { Button } from '#/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/popover'
import { useDeleteAddress } from '#/features/address/api/addresses'

/**
 * Edit and delete, behind the row's own menu.
 *
 * A sibling of the label rather than inside it: a button nested in a `<label>` is a click the
 * browser forwards to the radio, so opening the menu would also select the row.
 */
export function AddressActions({ address }: { address: StoreCustomerAddress }) {
  const prompt = usePrompt()
  const deleteAddress = useDeleteAddress()
  const label = address.addressName || address.address1 || 'this address'

  // Delete goes through a confirmation: a one-tap destructive action on the row the order is
  // about to ship to is a mis-tap waiting to happen.
  const confirmAndDelete = async () => {
    const confirmed = await prompt({
      title: 'Remove this address?',
      description: `${label} will be removed from your address book. This cannot be undone.`,
      confirmText: 'Remove',
    })

    if (!confirmed) return

    deleteAddress.mutate(address.id)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label="Address options" className="-mt-1 -mr-1 size-11" />}
      >
        <MoreVerticalIcon className="size-5" />
      </PopoverTrigger>
      <PopoverContent>
        <Button
          variant="ghost"
          render={<Link to="/checkout/addresses/$addressId/edit" params={{ addressId: address.id }} />}
          className="h-10 w-full justify-start px-3 hover:bg-transparent dark:hover:bg-transparent"
        >
          Edit address
        </Button>
        <Button
          variant="ghost"
          onClick={confirmAndDelete}
          disabled={deleteAddress.isPending}
          className="h-10 w-full justify-start px-3 text-sale hover:bg-transparent hover:text-sale dark:hover:bg-transparent"
        >
          Delete address
        </Button>
      </PopoverContent>
    </Popover>
  )
}
