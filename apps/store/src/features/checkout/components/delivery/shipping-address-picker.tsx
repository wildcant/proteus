import { Field, FieldError, FieldGroup, FieldLabel, FieldSet, RadioGroup, RadioGroupItem, usePrompt } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { MoreVerticalIcon, PlusIcon } from 'lucide-react'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { Button } from '#/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/popover'
import { useDeleteAddress } from '#/features/address/api/addresses'
import { AddressLines } from '#/features/address/components/address-lines'
import { withForm } from '#/lib/form-hook'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import { checkoutFormOpts, toCartAddressInput } from '../../hooks/use-checkout-form'

type DeepNonNullableProps<T> = {
  [K in keyof T]-?: NonNullable<T[K]>
}
type ShppingAddressPickerProps = DeepNonNullableProps<Pick<CheckoutData, 'cart' | 'addresses' | 'customer'>>

export const ShppingAddressPicker = withForm({
  ...checkoutFormOpts,
  props: {} as ShppingAddressPickerProps,
  render: function ShppingAddressPicker({ form, addresses, customer }) {
    return (
      <div className="border border-line p-4">
        <p className="m-0 text-ink-muted text-sm">Ship to</p>

        <FieldGroup>
          <form.Field name="shippingAddress">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <FieldSet>
                  <RadioGroup
                    name={field.name}
                    value={field.state.value}
                    onValueChange={(value: StoreCustomerAddress) => {
                      // TODO(address): Fix customer address make properties quired.
                      field.handleChange(toCartAddressInput(value, customer))
                    }}
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
                            <RadioGroupItem value={toCartAddressInput(address, customer)} className="mt-0.5" />
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
                  {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
                </FieldSet>
              )
            }}
          </form.Field>
        </FieldGroup>

        <Button variant="link" render={<Link to="/checkout/addresses/new" />} className="mt-4 gap-2 text-sm">
          <PlusIcon className="size-4" />
          Use a different address
        </Button>
      </div>
    )
  },
})

/**
 * Edit and delete, behind the row's own menu.
 *
 * A sibling of the label rather than inside it: a button nested in a `<label>` is a click the
 * browser forwards to the radio, so opening the menu would also select the row.
 */

function AddressActions({ address }: { address: StoreCustomerAddress }) {
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
