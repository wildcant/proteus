import { Field, FieldError, FieldGroup, FieldLabel, FieldSet, RadioGroup, RadioGroupItem } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '#/components/button'
import { AddressLines } from '#/features/address/components/address-lines'
import { withForm } from '#/lib/form-hook'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'
import type { CheckoutAddress } from '../../utils/checkout-address'
import { AddressActions } from './address-actions'

type DeepNonNullableProps<T> = {
  [K in keyof T]-?: NonNullable<T[K]>
}
type ShppingAddressPickerProps = DeepNonNullableProps<Pick<CheckoutData, 'cart' | 'addresses' | 'cartAddresses'>>

export const ShppingAddressPicker = withForm({
  ...checkoutFormOpts,
  props: {} as ShppingAddressPickerProps,
  render: function ShppingAddressPicker({ form, addresses, cartAddresses }) {
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
      form.setFieldValue('shippingAddress', live ?? checkoutFormOpts.defaultValues.shippingAddress)
    }, [cartAddresses, form])

    return (
      <FieldGroup>
        <form.Field name="shippingAddress">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <FieldSet>
                <div className="border border-line p-4">
                  <p className="m-0 text-ink-muted text-sm">Ship to</p>

                  <RadioGroup
                    name={field.name}
                    // Resolved through the map rather than passed straight from form state: base-ui
                    // compares the group value to each item with `===`, and an address edit rebuilds
                    // the map, leaving what the field holds a stale twin of the object the rows render.
                    value={field.state.value.id ? (cartAddresses.get(field.state.value.id) ?? null) : null}
                    onValueChange={(address: CheckoutAddress) => field.handleChange(address)}
                  >
                    {addresses.map((address) => {
                      const isDefault = address.isDefaultBilling && address.isDefaultShipping
                      return (
                        <Field
                          key={address.id}
                          orientation="horizontal"
                          className="items-start gap-0 p-3 has-data-checked:bg-surface-subtle"
                        >
                          <FieldLabel className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 has-data-checked:bg-transparent">
                            <RadioGroupItem value={cartAddresses.get(address.id)} className="mt-0.5" />
                            <div className="min-w-0">
                              <AddressLines address={address} />
                              {!!isDefault && (
                                <span className="mt-3 inline-flex bg-ink px-2 py-0.5 text-surface text-xs">
                                  Default
                                </span>
                              )}
                            </div>
                          </FieldLabel>

                          <AddressActions address={address} />
                        </Field>
                      )
                    })}
                  </RadioGroup>

                  <Button variant="link" render={<Link to="/checkout/addresses/new" />} className="mt-4 gap-2 text-sm">
                    <PlusIcon className="size-4" />
                    Use a different address
                  </Button>
                </div>

                {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
              </FieldSet>
            )
          }}
        </form.Field>
      </FieldGroup>
    )
  },
})
