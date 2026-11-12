import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import {
  addressBookEmpty,
  addressBookEmptyMessage,
  addressBookEmptyMessageText,
  addressBookEmptyTitle,
} from '#/features/address/components/address-book-empty/address-book-empty.variants'

/** Two lines of type, no illustration and no border — it is the same block at every width. */
export function AddressBookEmpty({ className }: { className?: string }) {
  return (
    <div className={cn(addressBookEmpty(), className)}>
      <h2 className={addressBookEmptyTitle()}>
        <Trans>Address book is empty</Trans>
      </h2>
      <div className={addressBookEmptyMessage()}>
        <p className={addressBookEmptyMessageText()}>
          <Trans>Add addresses to your address book and you'll be able to checkout faster</Trans>
        </p>
      </div>
    </div>
  )
}
