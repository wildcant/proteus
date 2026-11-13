import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useId } from 'react'
import { CountryOptions } from '#/components/form/country-options'
import { NativeSelectOption } from '#/components/ui/native-select/native-select'
import {
  shippingAddressForm,
  shippingAddressFormBilling,
  shippingAddressFormBillingCountry,
  shippingAddressFormBillingFields,
  shippingAddressFormBillingFieldsAddress1,
  shippingAddressFormBillingFieldsAddress2,
  shippingAddressFormBillingFieldsCity,
  shippingAddressFormBillingFieldsCompany,
  shippingAddressFormBillingFieldsFirstName,
  shippingAddressFormBillingFieldsLastName,
  shippingAddressFormBillingFieldsPostalCode,
  shippingAddressFormBillingFieldsProvince,
  shippingAddressFormBillingSame,
  shippingAddressFormBillingSameField,
  shippingAddressFormBillingTitle,
  shippingAddressFormCountry,
  shippingAddressFormFields,
  shippingAddressFormFieldsAddress1,
  shippingAddressFormFieldsAddress2,
  shippingAddressFormFieldsCity,
  shippingAddressFormFieldsCompany,
  shippingAddressFormFieldsFirstName,
  shippingAddressFormFieldsLastName,
  shippingAddressFormFieldsPostalCode,
  shippingAddressFormFieldsProvince,
  shippingAddressFormPhone,
} from '#/features/checkout/components/shipping-address-form/shipping-address-form.variants'
import { checkoutFormOpts } from '#/features/checkout/hooks/use-checkout-form'
import { withForm } from '#/lib/form-hook'

/**
 * The address block. No submit: when the values parse and differ from what the cart holds, focus
 * leaving the block writes them, which is the single request that unlocks the shipping rates —
 * see `CommitOnBlur` for why one handler covers all ten fields.
 *
 * Country still comes first, though it is no longer a question: it is the field the rest of the
 * address is read against, and reading it before typing a postal code is what tells a shopper
 * which shape of postal code the form is expecting. The market has already decided it, so the
 * delivery country is shown rather than asked for; the billing one below is still a choice,
 * because a card is registered where its holder banks.
 */
export const ShippingAddressForm = withForm({
  ...checkoutFormOpts,
  props: {} as { className?: string },
  render: function ShippingAddressForm({ form, className }) {
    const { t } = useLingui()
    const billingHeadingId = useId()

    return (
      <div className={cn(shippingAddressForm(), className)}>
        <div className={shippingAddressFormFields()}>
          <form.AppField name="shippingAddress.countryCode">
            {(field) => <field.CountryField className={shippingAddressFormCountry()} />}
          </form.AppField>
          <form.AppField name="shippingAddress.firstName">
            {(field) => (
              <field.TextField
                label={t`First name`}
                autoComplete="given-name"
                className={shippingAddressFormFieldsFirstName()}
              />
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.lastName">
            {(field) => (
              <field.TextField
                label={t`Last name`}
                autoComplete="family-name"
                className={shippingAddressFormFieldsLastName()}
              />
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.address1">
            {(field) => (
              <field.TextField
                label={t`Address`}
                autoComplete="address-line1"
                className={shippingAddressFormFieldsAddress1()}
              />
            )}
          </form.AppField>
          {/* Never rendered before this ticket, though it has always been in the schema and in the
            defaults — so an apartment number could be saved in the address book and not at
            checkout. Same label the address book uses. */}
          <form.AppField name="shippingAddress.address2">
            {(field) => (
              <field.TextField
                label={t`Apartment, suite, etc.`}
                autoComplete="address-line2"
                className={shippingAddressFormFieldsAddress2()}
              />
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.company">
            {(field) => (
              <field.TextField
                label={t`Company`}
                autoComplete="organization"
                className={shippingAddressFormFieldsCompany()}
              />
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.city">
            {(field) => (
              <field.TextField
                label={t`City`}
                autoComplete="address-level2"
                className={shippingAddressFormFieldsCity()}
              />
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.postalCode">
            {(field) => (
              <field.TextField
                label={t`Postal code`}
                autoComplete="postal-code"
                className={shippingAddressFormFieldsPostalCode()}
              />
            )}
          </form.AppField>
          {/* Free text, not a select: there is no subdivision data for any country in the system. */}
          <form.AppField name="shippingAddress.province">
            {(field) => (
              <field.TextField
                label={t`State / Province`}
                autoComplete="address-level1"
                className={shippingAddressFormFieldsProvince()}
              />
            )}
          </form.AppField>
          <form.AppField name="shippingAddress.phone">
            {(field) => (
              <field.TextField label={t`Phone`} type="tel" autoComplete="tel" className={shippingAddressFormPhone()} />
            )}
          </form.AppField>
        </div>

        {/* Stretched so the checkbox's label spans the form: its click area, which the drawn hug width would cut to the text. */}
        <div className={cn(shippingAddressFormBillingSame(), 'self-stretch')}>
          <form.AppField name="billingSameAsShipping">
            {(field) => (
              <field.CheckboxField
                label={t`Billing address same as shipping`}
                className={shippingAddressFormBillingSameField()}
              />
            )}
          </form.AppField>
        </div>

        <form.Subscribe selector={(state) => state.values.billingSameAsShipping}>
          {(sameAsBilling) =>
            !sameAsBilling && (
              // A named region, not a bare div: every label below repeats one from the delivery
              // block above it, so without a name around them "Country" and "City" mean two
              // things on one page — to a screen reader reading landmarks as much as to a test
              // trying to reach the second of each.
              <section aria-labelledby={billingHeadingId} className={shippingAddressFormBilling()}>
                <h3 id={billingHeadingId} className={cn(shippingAddressFormBillingTitle(), 'm-0')}>
                  <Trans>Billing address</Trans>
                </h3>
                <div className={shippingAddressFormBillingFields()}>
                  <form.AppField name="billingAddress.countryCode">
                    {(field) => (
                      <field.SelectField label={t`Country`} className={shippingAddressFormBillingCountry()}>
                        <NativeSelectOption value="">{t`Select country`}</NativeSelectOption>
                        <CountryOptions />
                      </field.SelectField>
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.firstName">
                    {(field) => (
                      <field.TextField
                        label={t`First name`}
                        autoComplete="billing given-name"
                        className={shippingAddressFormBillingFieldsFirstName()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.lastName">
                    {(field) => (
                      <field.TextField
                        label={t`Last name`}
                        autoComplete="billing family-name"
                        className={shippingAddressFormBillingFieldsLastName()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.address1">
                    {(field) => (
                      <field.TextField
                        label={t`Address`}
                        autoComplete="billing address-line1"
                        className={shippingAddressFormBillingFieldsAddress1()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.address2">
                    {(field) => (
                      <field.TextField
                        label={t`Apartment, suite, etc.`}
                        autoComplete="billing address-line2"
                        className={shippingAddressFormBillingFieldsAddress2()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.company">
                    {(field) => (
                      <field.TextField
                        label={t`Company`}
                        autoComplete="billing organization"
                        className={shippingAddressFormBillingFieldsCompany()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.city">
                    {(field) => (
                      <field.TextField
                        label={t`City`}
                        autoComplete="billing address-level2"
                        className={shippingAddressFormBillingFieldsCity()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.postalCode">
                    {(field) => (
                      <field.TextField
                        label={t`Postal code`}
                        autoComplete="billing postal-code"
                        className={shippingAddressFormBillingFieldsPostalCode()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="billingAddress.province">
                    {(field) => (
                      <field.TextField
                        label={t`State / Province`}
                        autoComplete="billing address-level1"
                        className={shippingAddressFormBillingFieldsProvince()}
                      />
                    )}
                  </form.AppField>
                </div>
              </section>
            )
          }
        </form.Subscribe>
      </div>
    )
  },
})
