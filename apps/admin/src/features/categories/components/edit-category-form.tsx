import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminProductCategory } from '#/api/generated/model'
import { useEditCategoryForm } from '#/features/categories/hooks/use-edit-category-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditCategoryForm({ category }: { category: AdminProductCategory }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useEditCategoryForm(category, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Edit Category</Trans>
            </RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="name">{(field) => <field.TextField label={t`Name`} autoFocus />}</form.AppField>
            <form.AppField name="handle">{(field) => <field.TextField label={t`Handle`} />}</form.AppField>
            <form.AppField name="description">
              {(field) => <field.TextareaField label={t`Description`} rows={3} />}
            </form.AppField>
            <form.AppField name="isActive">
              {(field) => <field.SwitchField label={t`Active`} description={t`Shown on the store.`} />}
            </form.AppField>
            <form.AppField name="isInternal">
              {(field) => (
                <field.SwitchField
                  label={t`Internal`}
                  description={t`Assignable to products here, never shown on the store.`}
                />
              )}
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
