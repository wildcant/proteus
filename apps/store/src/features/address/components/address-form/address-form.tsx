import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Form } from '#/components/form/form.tsx'
import { Button } from '#/components/ui/button/button'
import { RouteDrawer } from '#/components/ui/route-drawer/route-drawer'
import {
  addressForm,
  addressFormAddress1,
  addressFormAddress2,
  addressFormAddressName,
  addressFormCity,
  addressFormCompany,
  addressFormCountry,
  addressFormDrawer,
  addressFormFields,
  addressFormFirstName,
  addressFormIsDefault,
  addressFormLastName,
  addressFormNames,
  addressFormPhone,
  addressFormPostalCode,
  addressFormProvince,
  addressFormRegion,
} from '#/features/address/components/address-form/address-form.variants'
import { addressFormOpts } from '#/features/address/utils/form-values'
import { withForm } from '#/lib/form-hook'

/**
 * The address form itself, shared by the add and edit drawers.
 *
 * It is a `withForm` component rather than one taking `address?`, so neither the fields nor the
 * drawer chrome know which of the two they are in — the caller has already chosen a hook, and the
 * only thing that differs here is the title. Both forms share one set of options, which is what
 * `withForm` binds to.
 *
 * The `<form>` is both the set's root and the drawer's column inside the route's `RouteDrawer`.
 */
export const AddressForm = withForm({
  ...addressFormOpts,
  props: { title: '' },
  render: function AddressForm({ form, title }) {
    const { t } = useLingui()
    return (
      <RouteDrawer.Form
        form={form}
        copy={{
          title: t`You have unsaved changes`,
          description: t`Are you sure you want to leave? Your unsaved changes will be lost.`,
          cancel: t`Cancel`,
          confirm: t`Continue`,
        }}
      >
        <Form onSubmit={form.handleSubmit} className={cn(addressForm(), addressFormDrawer(), 'min-h-0')}>
          <form.AppForm>
            <RouteDrawer.Header>
              <RouteDrawer.Title>{title}</RouteDrawer.Title>
            </RouteDrawer.Header>

            <RouteDrawer.Body>
              <div className={addressFormFields()}>
                <form.AppField name="addressName">
                  {(field) => (
                    <field.TextField label={t`Label (e.g. Home)`} autoFocus className={addressFormAddressName()} />
                  )}
                </form.AppField>

                <div className={addressFormNames()}>
                  <form.AppField name="firstName">
                    {(field) => (
                      <field.TextField
                        label={t`First name`}
                        autoComplete="given-name"
                        className={addressFormFirstName()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="lastName">
                    {(field) => (
                      <field.TextField
                        label={t`Last name`}
                        autoComplete="family-name"
                        className={addressFormLastName()}
                      />
                    )}
                  </form.AppField>
                </div>

                <form.AppField name="company">
                  {(field) => (
                    <field.TextField label={t`Company`} autoComplete="organization" className={addressFormCompany()} />
                  )}
                </form.AppField>
                <form.AppField name="address1">
                  {(field) => (
                    <field.TextField
                      label={t`Address`}
                      autoComplete="address-line1"
                      className={addressFormAddress1()}
                    />
                  )}
                </form.AppField>
                <form.AppField name="address2">
                  {(field) => (
                    <field.TextField
                      label={t`Apartment, suite, etc.`}
                      autoComplete="address-line2"
                      className={addressFormAddress2()}
                    />
                  )}
                </form.AppField>

                <div className={addressFormRegion()}>
                  <form.AppField name="city">
                    {(field) => (
                      <field.TextField label={t`City`} autoComplete="address-level2" className={addressFormCity()} />
                    )}
                  </form.AppField>
                  {/* Not a choice: the market the shopper is in is the country the store ships to,
                      and an address book full of countries nothing can be sent to is a book of
                      addresses that fail at the end of a checkout rather than at the start. */}
                  <form.AppField name="countryCode">
                    {(field) => <field.CountryField className={addressFormCountry()} />}
                  </form.AppField>
                  <form.AppField name="province">
                    {(field) => (
                      <field.TextField
                        label={t`State / Province`}
                        autoComplete="address-level1"
                        className={addressFormProvince()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="postalCode">
                    {(field) => (
                      <field.TextField
                        label={t`Postal code`}
                        autoComplete="postal-code"
                        className={addressFormPostalCode()}
                      />
                    )}
                  </form.AppField>
                </div>

                <form.AppField name="phone">
                  {(field) => (
                    <field.TextField label={t`Phone`} type="tel" autoComplete="tel" className={addressFormPhone()} />
                  )}
                </form.AppField>

                {/* One checkbox for two flags. Nobody thinks in separate shipping and billing
                    defaults; the model keeps them apart so splitting them stays a UI change. */}
                <form.AppField name="isDefault">
                  {(field) => (
                    <field.CheckboxField label={t`Make this my main address`} className={addressFormIsDefault()} />
                  )}
                </form.AppField>
              </div>
            </RouteDrawer.Body>

            <RouteDrawer.Footer>
              <RouteDrawer.Close render={<Button variant="outline" size="sm" type="button" />}>
                <Trans>Cancel</Trans>
              </RouteDrawer.Close>
              <form.SubmitButton size="sm">
                <Trans>Save</Trans>
              </form.SubmitButton>
            </RouteDrawer.Footer>
          </form.AppForm>
        </Form>
      </RouteDrawer.Form>
    )
  },
})
