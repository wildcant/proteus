import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminStore } from '#/api/generated/model'
import { StoreRegionSelect } from '#/features/store/components/store-region-select'
import { useEditStoreForm } from '#/features/store/hooks/use-edit-store-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditStoreForm({ store }: { store: AdminStore }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useEditStoreForm(store, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Edit Store</Trans>
            </RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="name">
              {(field) => <field.TextField label={t`Name`} autoFocus placeholder={t`e.g. Proteus`} />}
            </form.AppField>
            <form.Field name="defaultRegionId">
              {(field) => (
                <StoreRegionSelect
                  value={field.state.value ?? null}
                  onChange={field.handleChange}
                  errors={field.state.meta.isValid ? undefined : field.state.meta.errors}
                />
              )}
            </form.Field>
            {/* Cleared rather than zeroed to turn the low state off: the field empties to `null`,
                and the API refuses a zero precisely so the two ways of saying "off" do not differ. */}
            <form.AppField name="lowStockThreshold">
              {(field) => <field.NumberField label={t`Low stock threshold`} placeholder={t`e.g. 5`} />}
            </form.AppField>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
