import { RouteDrawer } from '@proteus/ui'
import { Button } from '#/components/button'
import { Form } from '#/components/form/form.tsx'
import { addressFormOpts } from '#/features/address/form-values'
import { withForm } from '#/lib/form-hook'

/**
 * The address form itself, shared by the add and edit drawers.
 *
 * It is a `withForm` component rather than one taking `address?`, so neither the fields nor the
 * drawer chrome know which of the two they are in — the caller has already chosen a hook, and the
 * only thing that differs here is the title. Both forms share one set of options, which is what
 * `withForm` binds to.
 */
export const AddressForm = withForm({
  ...addressFormOpts,
  props: { title: '', isPending: false },
  render: function AddressForm({ form, title, isPending }) {
    return (
      <RouteDrawer.Form form={form}>
        <Form onSubmit={form.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <RouteDrawer.Header>
            <RouteDrawer.Title className="type-heading text-ink">{title}</RouteDrawer.Title>
          </RouteDrawer.Header>

          <RouteDrawer.Body className="flex flex-col gap-4">
            <form.AppField name="addressName">
              {(field) => <field.TextField label="Label (e.g. Home)" autoFocus />}
            </form.AppField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <form.AppField name="firstName">
                {(field) => <field.TextField label="First name" autoComplete="given-name" />}
              </form.AppField>
              <form.AppField name="lastName">
                {(field) => <field.TextField label="Last name" autoComplete="family-name" />}
              </form.AppField>
            </div>

            <form.AppField name="company">
              {(field) => <field.TextField label="Company" autoComplete="organization" />}
            </form.AppField>
            <form.AppField name="address1">
              {(field) => <field.TextField label="Address" autoComplete="address-line1" />}
            </form.AppField>
            <form.AppField name="address2">
              {(field) => <field.TextField label="Apartment, suite, etc." autoComplete="address-line2" />}
            </form.AppField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <form.AppField name="city">
                {(field) => <field.TextField label="City" autoComplete="address-level2" />}
              </form.AppField>
              {/* Not a choice: the market the shopper is in is the country the store ships to,
                  and an address book full of countries nothing can be sent to is a book of
                  addresses that fail at the end of a checkout rather than at the start. */}
              <form.AppField name="countryCode">{(field) => <field.DeliveryCountryField />}</form.AppField>
              <form.AppField name="province">
                {(field) => <field.TextField label="State / Province" autoComplete="address-level1" />}
              </form.AppField>
              <form.AppField name="postalCode">
                {(field) => <field.TextField label="Postal code" autoComplete="postal-code" />}
              </form.AppField>
            </div>

            <form.AppField name="phone">
              {(field) => <field.TextField label="Phone" type="tel" autoComplete="tel" />}
            </form.AppField>

            {/* One checkbox for two flags. Nobody thinks in separate shipping and billing
                defaults; the model keeps them apart so splitting them stays a UI change. */}
            <form.AppField name="isDefault">
              {(field) => <field.CheckboxField label="Make this my main address" />}
            </form.AppField>
          </RouteDrawer.Body>

          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="outline" size="sm" type="button" />}>Cancel</RouteDrawer.Close>
            <Button type="submit" size="sm" disabled={isPending}>
              Save
            </Button>
          </RouteDrawer.Footer>
        </Form>
      </RouteDrawer.Form>
    )
  },
})
