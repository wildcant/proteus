import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminCountry } from '#/api/generated/model'
import { useEditCountryLocaleForm } from '#/features/regions/hooks/use-edit-country-locale-form'

type EditCountryLocaleFormProps = {
  regionId: string
  country: AdminCountry
}

/**
 * Repoints a country's locale.
 *
 * Editable rather than fixed at assignment, because a wrong locale is a market that formats its
 * money and dates in the wrong conventions and there is no other way to repair one. The warning is
 * the scope of that decision: the URLs built from the old tag stop resolving, and nothing here
 * rewrites the links already pointing at them.
 */
export function EditCountryLocaleForm({ regionId, country }: EditCountryLocaleFormProps) {
  const { handleSuccess } = useRouteModal()

  const { form } = useEditCountryLocaleForm(regionId, country, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit Locale</RouteDrawer.Title>
          <RouteDrawer.Description>{country.displayName}</RouteDrawer.Description>
        </RouteDrawer.Header>
        <RouteDrawer.Body className="flex flex-col gap-y-6">
          <form.AppField name="localeCode">
            {(field) => <field.TextField label="Locale" autoFocus placeholder="e.g. es-CO" />}
          </form.AppField>
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-muted-foreground text-sm">
            This changes the live storefront URLs for {country.displayName}. Links to the current ones stop resolving —
            nothing redirects them.
          </p>
        </RouteDrawer.Body>
        <RouteDrawer.Footer>
          <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteDrawer.Close>
          <Button type="submit" size="sm">
            Save
          </Button>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
