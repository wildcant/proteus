import { NativeSelectOption } from '@proteus/ui'
import { CountryOptions } from '#/components/form/country-options'
import { withForm } from '#/lib/form-hook'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'

/**
 * The address block. No submit: when the values parse and differ from what the cart holds, focus
 * leaving the block writes them, which is the single request that unlocks the shipping rates —
 * see `CommitOnBlur` for why one handler covers all ten fields.
 *
 * Country comes first because it is the field the rest of the address is read against and the one
 * the rates depend on — filling the form top to bottom is then the same order as the promise the
 * shipping placeholder makes.
 */
export const ShippingAddressForm = withForm({
  ...checkoutFormOpts,
  render: function ShippingAddressForm({ form }) {
    return (
      <div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.AppField name="shippingAddress.countryCode">
            {(field) => (
              <field.SelectField label="Country" className="sm:col-span-2">
                <NativeSelectOption value="">Select country</NativeSelectOption>
                <CountryOptions />
              </field.SelectField>
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.firstName">
            {(field) => <field.TextField label="First name" autoComplete="given-name" />}
          </form.AppField>
          <form.AppField name="shippingAddress.lastName">
            {(field) => <field.TextField label="Last name" autoComplete="family-name" />}
          </form.AppField>
          <form.AppField name="shippingAddress.address1">
            {(field) => <field.TextField label="Address" autoComplete="address-line1" className="sm:col-span-2" />}
          </form.AppField>
          {/* Never rendered before this ticket, though it has always been in the schema and in the
            defaults — so an apartment number could be saved in the address book and not at
            checkout. Same label the address book uses. */}
          <form.AppField name="shippingAddress.address2">
            {(field) => (
              <field.TextField label="Apartment, suite, etc." autoComplete="address-line2" className="sm:col-span-2" />
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.company">
            {(field) => <field.TextField label="Company" autoComplete="organization" className="sm:col-span-2" />}
          </form.AppField>
          <form.AppField name="shippingAddress.city">
            {(field) => <field.TextField label="City" autoComplete="address-level2" />}
          </form.AppField>
          <form.AppField name="shippingAddress.postalCode">
            {(field) => <field.TextField label="Postal code" autoComplete="postal-code" />}
          </form.AppField>
          {/* Free text, not a select: there is no subdivision data for any country in the system. */}
          <form.AppField name="shippingAddress.province">
            {(field) => (
              <field.TextField label="State / Province" autoComplete="address-level1" className="sm:col-span-2" />
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.phone">
            {(field) => <field.TextField label="Phone" type="tel" autoComplete="tel" className="sm:col-span-2" />}
          </form.AppField>
        </div>

        <div className="mt-4">
          <form.AppField name="billingSameAsShipping">
            {(field) => <field.CheckboxField label="Billing address same as shipping" />}
          </form.AppField>
        </div>

        <form.Subscribe selector={(state) => state.values.billingSameAsShipping}>
          {(sameAsBilling) =>
            !sameAsBilling && (
              <div className="mt-6">
                <h3 className="type-heading m-0 mb-4 text-ink">Billing address</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <form.AppField name="billingAddress.countryCode">
                    {(field) => (
                      <field.SelectField label="Country" className="sm:col-span-2">
                        <NativeSelectOption value="">Select country</NativeSelectOption>
                        <CountryOptions />
                      </field.SelectField>
                    )}
                  </form.AppField>
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
                  <form.AppField name="billingAddress.address2">
                    {(field) => (
                      <field.TextField
                        label="Apartment, suite, etc."
                        autoComplete="billing address-line2"
                        className="sm:col-span-2"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.company">
                    {(field) => (
                      <field.TextField label="Company" autoComplete="billing organization" className="sm:col-span-2" />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.city">
                    {(field) => <field.TextField label="City" autoComplete="billing address-level2" />}
                  </form.AppField>
                  <form.AppField name="billingAddress.postalCode">
                    {(field) => <field.TextField label="Postal code" autoComplete="billing postal-code" />}
                  </form.AppField>
                  <form.AppField name="billingAddress.province">
                    {(field) => (
                      <field.TextField
                        label="State / Province"
                        autoComplete="billing address-level1"
                        className="sm:col-span-2"
                      />
                    )}
                  </form.AppField>
                </div>
              </div>
            )
          }
        </form.Subscribe>
      </div>
    )
  },
})
