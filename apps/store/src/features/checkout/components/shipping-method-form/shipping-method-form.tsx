import { Trans } from '@lingui/react/macro'
import { CartAddressInput } from '@proteus/http-schemas/store'
import { cn } from '@proteus/ui-core'
import { useSelector } from '@tanstack/react-form'
import type { AddStoreCartShippingMethodBody } from '#/api/generated/model'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { Field, FieldGroup, FieldSet } from '#/components/ui/field/field'
import { FieldLabel } from '#/components/ui/field-label/field-label'
import { RadioGroup } from '#/components/ui/radio-group/radio-group'
import { RadioGroupItem } from '#/components/ui/radio-group-item/radio-group-item'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import { useSelectShippingMethod, useShippingOptions } from '#/features/checkout/api/checkout'
import {
  shippingMethodForm,
  shippingMethodFormChoice,
  shippingMethodFormName,
  shippingMethodFormOption,
  shippingMethodFormPrice,
  shippingMethodFormRadio,
} from '#/features/checkout/components/shipping-method-form/shipping-method-form.variants'
import { ShippingMethodNotice } from '#/features/checkout/components/shipping-method-notice/shipping-method-notice'
import type { CheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import { checkoutFormOpts } from '#/features/checkout/hooks/use-checkout-form'
import { useFormatters } from '#/hooks/use-formatters'
import { withForm } from '#/lib/form-hook'

type ShippingMethodFormProps = Pick<CheckoutData, 'cart' | 'isAddressesLoading'> & { className?: string }
export const ShippingMethodForm = withForm({
  ...checkoutFormOpts,
  props: {} as ShippingMethodFormProps,
  render: function ShippingMethodForm({ form, cart, isAddressesLoading, className }) {
    const { formatPrice } = useFormatters()
    const shippingAddress = useSelector(form.store, (state) => state.values.shippingAddress)
    const { success: isValidShippingAddress } = CartAddressInput.safeParse(shippingAddress)

    const { mutate: selectMethod } = useSelectShippingMethod()
    const selectPaymentMethod = (payload: AddStoreCartShippingMethodBody) =>
      selectMethod(payload, {
        onError: () => form.resetField('shippingOptionId'),
      })

    const { data, isLoading } = useShippingOptions(
      cart.id,
      // No country: the endpoint reads it off the cart, so sending the one being typed here
      // would be a second answer to a question the cart has already settled.
      {
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode,
        province: shippingAddress.province ?? undefined,
      },
      { enabled: isValidShippingAddress },
    )

    if (!isValidShippingAddress) {
      return <ShippingMethodNotice className={className} />
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
      return (
        <p className="m-0 text-ink-muted text-sm">
          <Trans>No shipping options available for your address.</Trans>
        </p>
      )
    }

    return (
      <FieldGroup className={className}>
        <form.Field name="shippingOptionId">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <FieldSet>
                <RadioGroup
                  name={field.name}
                  value={field.state.value}
                  onValueChange={(shippingOptionId: string) => {
                    field.handleChange(shippingOptionId)
                    selectPaymentMethod({ shippingOptionId })
                  }}
                  disabled={isLoading}
                  className={shippingMethodForm()}
                >
                  {data.shippingOptions.map((option) => (
                    <Field key={option.id} orientation="horizontal">
                      {/* The chosen ink envelope follows the checked radio; the set draws the rest. */}
                      <FieldLabel
                        className={cn(
                          shippingMethodFormOption(),
                          'w-full cursor-pointer has-data-checked:border-ink has-data-checked:bg-transparent has-data-checked:ring-1 has-data-checked:ring-ink has-data-checked:ring-inset',
                        )}
                      >
                        <span className={shippingMethodFormChoice()}>
                          <RadioGroupItem value={option.id} className={shippingMethodFormRadio()} />
                          <span className={shippingMethodFormName()}>{option.name}</span>
                        </span>
                        <span className={cn(shippingMethodFormPrice(), 'tabular-nums')}>
                          {option.amount != null ? (
                            formatPrice(String(option.amount), cart.currencyCode)
                          ) : (
                            <Trans>Calculated</Trans>
                          )}
                        </span>
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
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
