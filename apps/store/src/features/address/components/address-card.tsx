import { Field, FieldLabel, RadioGroupItem, usePrompt } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { PencilIcon, Trash2Icon } from 'lucide-react'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { Button } from '#/components/button'
import { useDeleteAddress } from '#/features/address/api/addresses'
import { AddressLines } from '#/features/address/components/address-lines'

type AddressCardProps = {
  address: StoreCustomerAddress
  isDefault: boolean
}

/**
 * One full-width row per address: the postal block on the left, its actions on the right.
 *
 * The `RadioGroupItem` takes its group from `AddressList` rather than owning one — exactly one
 * address can be the main one, which is a property of the list, not of a row.
 */
export function AddressCard({ address, isDefault }: AddressCardProps) {
  const recipient = [address.firstName, address.lastName].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-6 border border-line p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
      <div className="min-w-0 flex-1">
        {/* addressName is optional, and four addresses in one city are unreadable without a
            label — so the recipient carries the heading when the shopper did not set one. */}
        <h3 className="type-heading text-ink">{address.addressName || recipient || 'Address'}</h3>
        <div className="mt-3">
          <AddressLines address={address} />
        </div>
      </div>

      {/* A wrapping row beneath the address on a phone, where there is no room beside it; a
          right-aligned column from lg, which is where the reference puts it. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 lg:flex-col lg:items-end">
        <Button
          variant="link"
          render={<Link to="/account/addresses/$addressId/edit" params={{ addressId: address.id }} />}
        >
          <PencilIcon />
          Edit
        </Button>
        <DeleteAddressButton address={address} />

        <Field orientation="horizontal" className="w-auto cursor-pointer items-center">
          <RadioGroupItem id={`default-${address.id}`} value={address.id} />
          <FieldLabel htmlFor={`default-${address.id}`} className="cursor-pointer text-ink-muted">
            {isDefault ? 'Main address' : 'Make this my main'}
          </FieldLabel>
        </Field>
      </div>
    </div>
  )
}

/**
 * Delete goes through a confirmation: a one-tap destructive action sitting next to an edit link
 * on a phone is a mis-tap waiting to happen.
 */
function DeleteAddressButton({ address }: { address: StoreCustomerAddress }) {
  const prompt = usePrompt()
  const deleteAddress = useDeleteAddress()
  const label = address.addressName || address.address1 || 'this address'

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
    <Button variant="link" className="text-sale" onClick={confirmAndDelete} disabled={deleteAddress.isPending}>
      <Trash2Icon />
      Delete
    </Button>
  )
}
