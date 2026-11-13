import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useEffect } from 'react'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { ButtonLink } from '#/components/ui/button/button'
import { Field, FieldGroup, FieldSet } from '#/components/ui/field/field'
import { FieldLabel } from '#/components/ui/field-label/field-label'
import { Icon } from '#/components/ui/icon/icon'
import { RadioGroup } from '#/components/ui/radio-group/radio-group'
import { RadioGroupItem } from '#/components/ui/radio-group-item/radio-group-item'
import { AddressLines } from '#/entities/address/ui/address-lines/address-lines'
import { AddressActions } from '#/features/checkout/components/address-actions/address-actions'
import {
  shippingAddressPicker,
  shippingAddressPickerAddress,
  shippingAddressPickerAddresses,
  shippingAddressPickerChoice,
  shippingAddressPickerDefaultBadge,
  shippingAddressPickerDefaultLabel,
  shippingAddressPickerDetails,
  shippingAddressPickerLegend,
  shippingAddressPickerLines,
  shippingAddressPickerNewAddress,
  shippingAddressPickerOptions,
  shippingAddressPickerRadio,
  shippingAddressPickerRadioWrap,
  shippingAddressPickerUseDifferent,
} from '#/features/checkout/components/shipping-address-picker/shipping-address-picker.variants'
import type { CheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import { checkoutFormOpts, emptyShippingAddress } from '#/features/checkout/hooks/use-checkout-form'
import type { CheckoutLinks } from '#/features/checkout/types/links'
import type { CheckoutAddress } from '#/features/checkout/utils/checkout-address'
import { useMarket } from '#/hooks/use-market'
import { withForm } from '#/lib/form-hook'

type DeepNonNullableProps<T> = {
  [K in keyof T]-?: NonNullable<T[K]>
}
type ShippingAddressPickerProps = DeepNonNullableProps<Pick<CheckoutData, 'cart' | 'addresses' | 'cartAddresses'>> & {
  links: Pick<CheckoutLinks, 'addAddress' | 'editAddress'>
  className?: string
}

export const ShippingAddressPicker = withForm({
  ...checkoutFormOpts,
  props: {} as ShippingAddressPickerProps,
  render: function ShippingAddressPicker({ form, addresses, cartAddresses, links, className }) {
    const { current } = useMarket()

    /**
     * Re-point the field at the live object: editing or deleting in the drawer rebuilds
     * `cartAddresses`, leaving what the field holds a stale twin. The selection is read rather than
     * depended on, so this runs when the map changes and not when the shopper picks a row.
     */
    useEffect(() => {
      const selected = form.state.values.shippingAddress
      if (!selected.id) return // Typed by hand — not the address book's to own.
      const live = cartAddresses.get(selected.id)
      if (live === selected) return
      // Deleted: there is nothing left to ship to, so the shopper picks again.
      form.setFieldValue('shippingAddress', live ?? emptyShippingAddress(current.iso2))
    }, [cartAddresses, form, current.iso2])

    return (
      <FieldGroup className={className}>
        <form.Field name="shippingAddress">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <FieldSet>
                <div className={shippingAddressPicker()}>
                  <p className={cn(shippingAddressPickerLegend(), 'm-0')}>
                    <Trans>Ship to</Trans>
                  </p>

                  <RadioGroup
                    name={field.name}
                    // Resolved through the map rather than passed straight from form state: base-ui
                    // compares the group value to each item with `===`, and an address edit rebuilds
                    // the map, leaving what the field holds a stale twin of the object the rows render.
                    value={field.state.value.id ? (cartAddresses.get(field.state.value.id) ?? null) : null}
                    onValueChange={(address: CheckoutAddress) => field.handleChange(address)}
                    className={shippingAddressPickerAddresses()}
                  >
                    {addresses.map((address) => {
                      const isDefault = address.isDefaultBilling && address.isDefaultShipping
                      return (
                        <Field
                          key={address.id}
                          orientation="horizontal"
                          // Drawn chosen: the fill follows the checked radio. `gap-0` undoes the
                          // Field's own gap, which the drawn row (a frame, not a Field) doesn't have.
                          className={cn(
                            shippingAddressPickerAddress(),
                            'gap-0 bg-transparent has-data-checked:bg-surface-subtle',
                          )}
                        >
                          <FieldLabel
                            className={cn(
                              shippingAddressPickerChoice(),
                              'min-w-0 cursor-pointer bg-transparent has-data-checked:bg-choice-checked',
                            )}
                          >
                            <span className={shippingAddressPickerRadioWrap()}>
                              <RadioGroupItem
                                value={cartAddresses.get(address.id)}
                                className={shippingAddressPickerRadio()}
                              />
                            </span>
                            <div className={cn(shippingAddressPickerDetails(), 'min-w-0')}>
                              <div className={shippingAddressPickerLines()}>
                                <AddressLines address={address} weight="medium" />
                              </div>
                              {!!isDefault && (
                                <span className={shippingAddressPickerDefaultBadge()}>
                                  <span className={shippingAddressPickerDefaultLabel()}>
                                    <Trans>Default</Trans>
                                  </span>
                                </span>
                              )}
                            </div>
                          </FieldLabel>

                          <AddressActions
                            address={address}
                            editLink={links.editAddress(address.id)}
                            className={shippingAddressPickerOptions()}
                          />
                        </Field>
                      )
                    })}
                  </RadioGroup>

                  {/* `block` / `inline-flex`: the link sits on a text line, as the store renders it —
                      the line's strut leaves 1.5px under it that the drawn flex row drops. `gap-2`
                      around the plus: the set draws the link label-only (icons slice). */}
                  <div className={cn(shippingAddressPickerNewAddress(), 'block')}>
                    <ButtonLink
                      {...links.addAddress}
                      variant="link"
                      className={cn(shippingAddressPickerUseDifferent(), 'inline-flex gap-2')}
                    >
                      <Icon name="plus" className="size-4" />
                      <Trans>Use a different address</Trans>
                    </ButtonLink>
                  </div>
                </div>

                {!!isInvalid && (
                  <TranslatedFieldError errors={field.state.meta.errors} values={field.form.state.values} />
                )}
              </FieldSet>
            )
          }}
        </form.Field>
      </FieldGroup>
    )
  },
})
