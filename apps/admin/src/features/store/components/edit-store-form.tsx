import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminStore } from '#/api/generated/model'
import { StoreRegionSelect } from '#/features/store/components/store-region-select'
import { useEditStoreForm } from '#/features/store/hooks/use-edit-store-form'

export function EditStoreForm({ store }: { store: AdminStore }) {
  const { handleSuccess } = useRouteModal()

  const { form } = useEditStoreForm(store, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header>
            <RouteDrawer.Title>Edit Store</RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="name">
              {(field) => <field.TextField label="Name" autoFocus placeholder="e.g. Proteus" />}
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
