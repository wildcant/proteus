import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { PlusIcon } from 'lucide-react'
import { Suspense } from 'react'
import { BackLink } from '#/components/store/back-link/back-link'
import { ButtonLink } from '#/components/ui/button/button'
import { RadioGroup } from '#/components/ui/radio-group/radio-group'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import { useSuspenseAddresses, useUpdateAddress } from '#/entities/address/api/addresses'
import {
  addressBook,
  addressBookAddAddress,
  addressBookAddress,
  addressBookAddresses,
  addressBookAside,
  addressBookBack,
  addressBookContent,
  addressBookHeading,
  addressBookList,
  addressBookListTitle,
  addressBookMainAddress,
  addressBookTitle,
} from '#/features/address/components/address-book/address-book.variants'
import { AddressBookEmpty } from '#/features/address/components/address-book-empty/address-book-empty'
import { AddressCard } from '#/features/address/components/address-card/address-card'
import { AddressListFallback } from '#/features/address/components/address-list-fallback/address-list-fallback'
import { MainAddressPanel } from '#/features/address/components/main-address-panel/main-address-panel'
import type { LinkTarget } from '#/lib/link-target'

/** The address book's ways out, the `AddressBook` screen's on the flow map. */
type AddressBookLinks = {
  /** BACK_TO_ACCOUNT. */
  account: LinkTarget
  /** ADD_ADDRESS. */
  addAddress: LinkTarget
  /** EDIT_ADDRESS. */
  editAddress: (addressId: string) => LinkTarget
}

/**
 * Phone-first: back link, title, the main address, the full-width ink button, then the list.
 * `lg:` introduces the split — main address and button in a narrow left column, the list on the
 * right.
 */
export function AddressBook({ links }: { links: AddressBookLinks }) {
  return (
    <main className={cn(addressBook(), 'mx-auto w-full')}>
      <div className={addressBookHeading()}>
        <BackLink link={links.account} className={addressBookBack()}>
          <Trans>Back to account</Trans>
        </BackLink>
        <h1 className={addressBookTitle()}>
          <Trans>Address book</Trans>
        </h1>
      </div>

      <div className={addressBookContent()}>
        {/* Its own boundary so the add button paints immediately rather than waiting on a panel
            that may not render at all. */}
        <div className={cn(addressBookAside(), 'shrink-0')}>
          <Suspense fallback={<Skeleton className="h-44 w-full" />}>
            <MainAddressPanel className={addressBookMainAddress()} />
          </Suspense>
          <ButtonLink {...links.addAddress} className={addressBookAddAddress()}>
            <PlusIcon />
            <Trans>Add an address</Trans>
          </ButtonLink>
        </div>

        <div className={cn(addressBookList(), 'min-w-0')}>
          <Suspense fallback={<AddressListFallback className="self-stretch" />}>
            <AddressList editLink={links.editAddress} />
          </Suspense>
        </div>
      </div>
    </main>
  )
}

function AddressList({ editLink }: { editLink: AddressBookLinks['editAddress'] }) {
  const { addresses } = useSuspenseAddresses()
  const updateAddress = useUpdateAddress()
  const main = addresses.find((address) => address.isDefaultShipping || address.isDefaultBilling)

  if (addresses.length === 0) return <AddressBookEmpty />

  return (
    <>
      <h2 className={addressBookListTitle()}>
        <Trans>Your addresses</Trans>
      </h2>
      {/* One group for the whole list: exactly one address can be the main one, and the endpoint
          releases the previous holder in the same transaction. */}
      <RadioGroup
        value={main?.id ?? ''}
        onValueChange={(addressId) =>
          updateAddress.mutate({ addressId: String(addressId), payload: { isDefault: true } })
        }
        className={addressBookAddresses()}
        render={<ul />}
      >
        {addresses.map((address) => (
          <li key={address.id} className={addressBookAddress()}>
            <AddressCard
              address={address}
              isDefault={address.id === main?.id}
              editLink={editLink(address.id)}
              className="w-full"
            />
          </li>
        ))}
      </RadioGroup>
    </>
  )
}
