import { NativeSelectOption } from '@proteus/ui'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Button } from '#/components/button'
import {
  type ShippingAddressFormValues,
  useShippingAddressForm,
} from '#/features/checkout/hooks/use-shipping-address-form'

type ShippingAddressFormProps = {
  cart: Pick<StoreCartDetailResponseCart, 'shippingAddress' | 'billingAddress'>
  onComplete: () => void
}

function getAddressDefaults(
  cart: Pick<StoreCartDetailResponseCart, 'shippingAddress' | 'billingAddress'>,
): ShippingAddressFormValues | undefined {
  if (!cart.shippingAddress) return undefined

  const hasSeparateBilling = cart.billingAddress && cart.billingAddress.id !== cart.shippingAddress.id

  const shippingAddress = {
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
  }

  return {
    shippingAddress,
    sameAsBilling: !hasSeparateBilling,
    billingAddress:
      hasSeparateBilling && cart.billingAddress
        ? {
            firstName: cart.billingAddress.firstName ?? '',
            lastName: cart.billingAddress.lastName ?? '',
            address1: cart.billingAddress.address1 ?? '',
            address2: cart.billingAddress.address2 ?? '',
            company: cart.billingAddress.company ?? '',
            city: cart.billingAddress.city ?? '',
            countryCode: cart.billingAddress.countryCode ?? '',
            province: cart.billingAddress.province ?? '',
            postalCode: cart.billingAddress.postalCode ?? '',
            phone: cart.billingAddress.phone ?? '',
          }
        : shippingAddress,
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
        if (form.getFieldValue('sameAsBilling')) {
          form.setFieldValue('billingAddress', form.getFieldValue('shippingAddress'))
        }
        form.handleSubmit()
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.AppField name="shippingAddress.firstName">
          {(field) => <field.TextField label="First name" autoComplete="given-name" />}
        </form.AppField>
        <form.AppField name="shippingAddress.lastName">
          {(field) => <field.TextField label="Last name" autoComplete="family-name" />}
        </form.AppField>
        <form.AppField name="shippingAddress.address1">
          {(field) => <field.TextField label="Address" autoComplete="address-line1" className="sm:col-span-2" />}
        </form.AppField>
        <form.AppField name="shippingAddress.company">
          {(field) => <field.TextField label="Company" autoComplete="organization" className="sm:col-span-2" />}
        </form.AppField>
        <form.AppField name="shippingAddress.city">
          {(field) => <field.TextField label="City" autoComplete="address-level2" />}
        </form.AppField>
        <form.AppField name="shippingAddress.countryCode">
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
        <form.AppField name="shippingAddress.province">
          {(field) => <field.TextField label="State / Province" autoComplete="address-level1" />}
        </form.AppField>
        <form.AppField name="shippingAddress.postalCode">
          {(field) => <field.TextField label="Postal code" autoComplete="postal-code" />}
        </form.AppField>
        <form.AppField name="shippingAddress.phone">
          {(field) => <field.TextField label="Phone" type="tel" autoComplete="tel" className="sm:col-span-2" />}
        </form.AppField>
      </div>

      <div className="mt-4">
        <form.AppField name="sameAsBilling">
          {(field) => <field.CheckboxField label="Billing address same as shipping" />}
        </form.AppField>
      </div>

      <form.Subscribe selector={(state) => state.values.sameAsBilling}>
        {(sameAsBilling) =>
          !sameAsBilling && (
            <div className="mt-6">
              <h3 className="mb-4 text-lg font-medium text-(--foreground)">Billing address</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.AppField name="billingAddress.firstName">
                  {(field) => <field.TextField label="First name" autoComplete="billing given-name" />}
                </form.AppField>
                <form.AppField name="billingAddress.lastName">
                  {(field) => <field.TextField label="Last name" autoComplete="billing family-name" />}
                </form.AppField>
                <form.AppField name="billingAddress.address1">
                  {(field) => (
                    <field.TextField label="Address" autoComplete="billing address-line1" className="sm:col-span-2" />
                  )}
                </form.AppField>
                <form.AppField name="billingAddress.company">
                  {(field) => (
                    <field.TextField label="Company" autoComplete="billing organization" className="sm:col-span-2" />
                  )}
                </form.AppField>
                <form.AppField name="billingAddress.postalCode">
                  {(field) => <field.TextField label="Postal code" autoComplete="billing postal-code" />}
                </form.AppField>
                <form.AppField name="billingAddress.city">
                  {(field) => <field.TextField label="City" autoComplete="billing address-level2" />}
                </form.AppField>
                <form.AppField name="billingAddress.countryCode">
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
                <form.AppField name="billingAddress.province">
                  {(field) => <field.TextField label="State / Province" autoComplete="billing address-level1" />}
                </form.AppField>
              </div>
            </div>
          )
        }
      </form.Subscribe>

      <Button type="submit" disabled={isPending} className="mt-6">
        {isPending ? 'Saving...' : 'Continue to delivery'}
      </Button>

      {!!error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}
    </form>
  )
}
