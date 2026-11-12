import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { ButtonLink } from '#/components/ui/button/button'
import { Field } from '#/components/ui/field/field'
import { FieldLabel } from '#/components/ui/field-label/field-label'
import { Icon } from '#/components/ui/icon/icon'
import { RadioGroupItem } from '#/components/ui/radio-group-item/radio-group-item'
import { AddressLines } from '#/entities/address/ui/address-lines/address-lines'
import {
  addressCard,
  addressCardActions,
  addressCardDelete,
  addressCardEdit,
  addressCardInfo,
  addressCardLines,
  addressCardMain,
  addressCardMainLabel,
  addressCardRadio,
  addressCardTitle,
} from '#/features/address/components/address-card/address-card.variants'
import { DeleteAddressButton } from '#/features/address/components/delete-address-button/delete-address-button'
import type { LinkTarget } from '#/lib/link-target'

type AddressCardProps = {
  address: StoreCustomerAddress
  isDefault: boolean
  /** EDIT_ADDRESS. */
  editLink: LinkTarget
  className?: string
}

/**
 * One full-width row per address: the postal block on the left, its actions on the right.
 *
 * The `RadioGroupItem` takes its group from `AddressList` rather than owning one — exactly one
 * address can be the main one, which is a property of the list, not of a row.
 */
export function AddressCard({ address, isDefault, editLink, className }: AddressCardProps) {
  const { t } = useLingui()
  const recipient = [address.firstName, address.lastName].filter(Boolean).join(' ')

  return (
    <div className={cn(addressCard(), className)}>
      <div className={cn(addressCardInfo(), 'min-w-0')}>
        {/* addressName is optional, and four addresses in one city are unreadable without a
            label — so the recipient carries the heading when the shopper did not set one. */}
        <h3 className={addressCardTitle()}>{address.addressName || recipient || t`Address`}</h3>
        <AddressLines address={address} className={addressCardLines()} />
      </div>

      {/* A wrapping row beneath the address on a phone, where there is no room beside it; a
          right-aligned column from lg, which is where the reference puts it. */}
      <div className={cn(addressCardActions(), 'shrink-0')}>
        <ButtonLink {...editLink} variant="link" className={addressCardEdit()}>
          <Icon name="pencil" />
          <Trans>Edit</Trans>
        </ButtonLink>
        <DeleteAddressButton address={address} className={addressCardDelete()} />

        {/* `w-auto`: Field fills its parent by default, and the set's main row hugs its label. */}
        <Field orientation="horizontal" className={cn(addressCardMain(), 'w-auto cursor-pointer')}>
          <RadioGroupItem id={`default-${address.id}`} value={address.id} className={addressCardRadio()} />
          <FieldLabel htmlFor={`default-${address.id}`} className={cn(addressCardMainLabel(), 'cursor-pointer')}>
            {isDefault ? <Trans>Main address</Trans> : <Trans>Make this my main</Trans>}
          </FieldLabel>
        </Field>
      </div>
    </div>
  )
}
