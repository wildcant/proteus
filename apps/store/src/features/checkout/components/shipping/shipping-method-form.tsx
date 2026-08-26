import { CartAddressInput, type StoreShippingOption } from '@proteus/http-schemas/store'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  formatPrice,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
} from '@proteus/ui'
import { useSelector } from '@tanstack/react-form'
import type { AddStoreCartShippingMethodBody } from '#/api/generated/model'
import { useSelectShippingMethod, useShippingOptions } from '#/features/checkout/api/checkout'
import { withForm } from '#/lib/form-hook'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'

type ShippingMethodFormProps = Pick<CheckoutData, 'cart' | 'isAddressesLoading'>
export const ShippingMethodForm = withForm({
  ...checkoutFormOpts,
  props: {} as ShippingMethodFormProps,
  render: function ShippingMethodForm({ form, cart, isAddressesLoading }) {
    const shippingAddress = useSelector(form.store, (state) => state.values.shippingAddress)
    const { success: isValidShippingAddress } = CartAddressInput.safeParse(shippingAddress)

    const { mutate: selectMethod } = useSelectShippingMethod()
    const selectPaymentMethod = (payload: AddStoreCartShippingMethodBody) =>
      selectMethod(payload, {
        onError: () => form.resetField('shippingOption'),
      })

    const { data, isLoading } = useShippingOptions(
      cart.id,
      {
        city: shippingAddress.city,
        countryCode: shippingAddress.countryCode,
        postalCode: shippingAddress.postalCode,
        province: shippingAddress.province ?? undefined,
      },
      { enabled: isValidShippingAddress },
    )

    if (!isValidShippingAddress) {
      return (
        <p className="m-0 bg-surface-subtle p-4 text-center text-ink-muted text-sm">
          Enter your shipping address to view available shipping methods.
        </p>
      )
    }

    if (isAddressesLoading || isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )
    }

    const hasShippingOptions = !data || data?.shippingOptions.length === 0
    if (hasShippingOptions) {
      return <p className="m-0 text-ink-muted text-sm">No shipping options available for your address.</p>
    }

    return (
      <FieldGroup>
        <form.Field name="shippingOption">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <FieldSet>
                <RadioGroup
                  name={field.name}
                  value={field.state.value}
                  onValueChange={(value: StoreShippingOption) => {
                    field.handleChange(value)
                    selectPaymentMethod({ shippingOptionId: value.id })
                  }}
                  disabled={isLoading}
                >
                  {data.shippingOptions.map((option) => (
                    <Field key={option.id} orientation="horizontal">
                      <FieldLabel className="flex w-full cursor-pointer items-center justify-between gap-3 border border-line p-4 has-data-checked:border-ink has-data-checked:bg-transparent has-data-checked:ring-1 has-data-checked:ring-ink has-data-checked:ring-inset">
                        <span className="flex items-center gap-3">
                          <RadioGroupItem value={option} />
                          <span className="font-medium text-ink text-sm">{option.name}</span>
                        </span>
                        <span className="font-medium text-ink text-sm tabular-nums">
                          {option.amount != null ? formatPrice(String(option.amount), cart.currencyCode) : 'Calculated'}
                        </span>
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
                {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
              </FieldSet>
            )
          }}
        </form.Field>
      </FieldGroup>
    )
  },
})
