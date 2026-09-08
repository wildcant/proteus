import { Button, KeyboundForm, RouteDrawer, Separator, useRouteModal } from '@proteus/ui'
import type { AdminRegion } from '#/api/generated/model'
import { RegionCurrencySelect } from '#/features/regions/components/region-currency-select'
import { RegionProviderSelect } from '#/features/regions/components/region-provider-select'
import { useEditRegionForm } from '#/features/regions/hooks/use-edit-region-form'

export function EditRegionForm({ region }: { region: AdminRegion }) {
  const { handleSuccess } = useRouteModal()

  const { form } = useEditRegionForm(region, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header>
            <RouteDrawer.Title>Edit Region</RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="name">
              {(field) => <field.TextField label="Name" autoFocus placeholder="e.g. Europe" />}
            </form.AppField>
            <form.Field name="currencyCode">
              {(field) => (
                <RegionCurrencySelect
                  value={field.state.value ?? ''}
                  onChange={field.handleChange}
                  errors={field.state.meta.isValid ? undefined : field.state.meta.errors}
                />
              )}
            </form.Field>
            <Separator />
            <form.Field name="paymentProviderIds">
              {(field) => <RegionProviderSelect value={field.state.value ?? []} onChange={field.handleChange} />}
            </form.Field>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteDrawer.Close>
            <form.SubmitButton size="sm">Save</form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
