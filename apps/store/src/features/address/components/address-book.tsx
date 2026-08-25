import { RadioGroup, Skeleton } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon, PlusIcon } from 'lucide-react'
import { Suspense } from 'react'
import { Button } from '#/components/button'
import { useSuspenseAddresses, useUpdateAddress } from '#/features/address/api/addresses'
import { AddressCard } from '#/features/address/components/address-card'
import { MainAddressPanel } from '#/features/address/components/main-address-panel'

/**
 * Phone-first: back link, title, the main address, the full-width ink button, then the list.
 * `lg:` introduces the split — main address and button in a narrow left column, the list on the
 * right.
 */
export function AddressBook() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Button variant="link" render={<Link to="/account" />} className="gap-1 text-ink-muted">
        <ChevronLeftIcon className="size-4" />
        Back to account
      </Button>
      <h1 className="type-display mt-4 text-ink">Address book</h1>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-10">
        {/* Its own boundary so the add button paints immediately rather than waiting on a panel
            that may not render at all. */}
        <div className="flex flex-col gap-4">
          <Suspense fallback={<Skeleton className="h-44 w-full" />}>
            <MainAddressPanel />
          </Suspense>
          <Button render={<Link to="/account/addresses/new" />} className="w-full">
            <PlusIcon />
            Add an address
          </Button>
        </div>

        <div>
          <Suspense fallback={<AddressListFallback />}>
            <AddressList />
          </Suspense>
        </div>
      </div>
    </main>
  )
}

function AddressList() {
  const { addresses } = useSuspenseAddresses()
  const updateAddress = useUpdateAddress()
  const main = addresses.find((address) => address.isDefaultShipping || address.isDefaultBilling)

  if (addresses.length === 0) return <AddressBookEmpty />

  return (
    <>
      <h2 className="type-heading text-ink">Your addresses</h2>
      {/* One group for the whole list: exactly one address can be the main one, and the endpoint
          releases the previous holder in the same transaction. */}
      <RadioGroup
        value={main?.id ?? ''}
        onValueChange={(addressId) =>
          updateAddress.mutate({ addressId: String(addressId), payload: { isDefault: true } })
        }
        render={<ul className="mt-6 flex flex-col gap-4" />}
      >
        {addresses.map((address) => (
          <li key={address.id}>
            <AddressCard address={address} isDefault={address.id === main?.id} />
          </li>
        ))}
      </RadioGroup>
    </>
  )
}

/** Two lines of type, no illustration and no border — it is the same block at every width. */
function AddressBookEmpty() {
  return (
    <div>
      <h2 className="type-heading text-ink">Address book is empty</h2>
      <p className="mt-3 max-w-90 text-ink-muted text-sm">
        Add addresses to your address book and you'll be able to checkout faster
      </p>
    </div>
  )
}

function AddressListFallback() {
  return (
    <ul className="flex flex-col gap-4">
      {Array.from({ length: 2 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <li key={index}>
          <Skeleton className="h-40 w-full" />
        </li>
      ))}
    </ul>
  )
}
