import { NativeSelectOption } from '@proteus/ui'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Button } from '#/components/button'
import {
  type ShippingAddressFormValues,
  useShippingAddressForm,
} from '#/features/checkout/hooks/use-shipping-address-form'

type ShippingAddressFormProps = {
  cart: Pick<StoreCartDetailResponseCart, 'shippingAddress'>
  onComplete: () => void
}

function getAddressDefaults(
  cart: Pick<StoreCartDetailResponseCart, 'shippingAddress'>,
): ShippingAddressFormValues | undefined {
  if (!cart.shippingAddress) return undefined

  return {
    firstName: cart.shippingAddress.firstName ?? '',
    lastName: cart.shippingAddress.lastName ?? '',
    address1: cart.shippingAddress.address1 ?? '',
    address2: cart.shippingAddress.address2 ?? '',
    company: cart.shippingAddress.company ?? '',
    city: cart.shippingAddress.city ?? '',
    countryCode: cart.shippingAddress.countryCode ?? '',
    province: cart.shippingAddress.province ?? '',
    postalCode: cart.shippingAddress.postalCode ?? '',
    phone: cart.shippingAddress.phone ?? '',
    sameAsBilling: true,
  }
}

export function ShippingAddressForm({ cart, onComplete }: ShippingAddressFormProps) {
  const { form, isPending, error } = useShippingAddressForm({
    defaultValues: getAddressDefaults(cart),
    onSuccess: onComplete,
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.AppField name="firstName">
          {(field) => <field.TextField label="First name" autoComplete="given-name" />}
        </form.AppField>
        <form.AppField name="lastName">
          {(field) => <field.TextField label="Last name" autoComplete="family-name" />}
        </form.AppField>
        <form.AppField name="address1">
          {(field) => <field.TextField label="Address" autoComplete="address-line1" className="sm:col-span-2" />}
        </form.AppField>
        <form.AppField name="company">
          {(field) => <field.TextField label="Company" autoComplete="organization" className="sm:col-span-2" />}
        </form.AppField>
        <form.AppField name="city">
          {(field) => <field.TextField label="City" autoComplete="address-level2" />}
        </form.AppField>
        <form.AppField name="countryCode">
          {(field) => (
            <field.SelectField label="Country">
              <NativeSelectOption value="">Select country</NativeSelectOption>
              <NativeSelectOption value="us">United States</NativeSelectOption>
              <NativeSelectOption value="ca">Canada</NativeSelectOption>
              <NativeSelectOption value="gb">United Kingdom</NativeSelectOption>
              <NativeSelectOption value="de">Germany</NativeSelectOption>
              <NativeSelectOption value="fr">France</NativeSelectOption>
              <NativeSelectOption value="au">Australia</NativeSelectOption>
              <NativeSelectOption value="se">Sweden</NativeSelectOption>
              <NativeSelectOption value="dk">Denmark</NativeSelectOption>
            </field.SelectField>
          )}
        </form.AppField>
        <form.AppField name="province">
          {(field) => <field.TextField label="State / Province" autoComplete="address-level1" />}
        </form.AppField>
        <form.AppField name="postalCode">
          {(field) => <field.TextField label="Postal code" autoComplete="postal-code" />}
        </form.AppField>
        <form.AppField name="phone">
          {(field) => <field.TextField label="Phone" type="tel" autoComplete="tel" className="sm:col-span-2" />}
        </form.AppField>
      </div>

      <div className="mt-4">
        <form.AppField name="sameAsBilling">
          {(field) => <field.CheckboxField label="Billing address same as shipping" />}
        </form.AppField>
      </div>

      <Button type="submit" disabled={isPending} className="mt-6">
        {isPending ? 'Saving...' : 'Continue to delivery'}
      </Button>

      {error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}
    </form>
  )
}
