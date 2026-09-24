import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, TagInput, useRouteModal } from '@proteus/ui'
import type { AdminProductOption } from '#/api/generated/model'
import { useEditProductOptionForm } from '#/features/product-options/hooks/use-edit-product-option-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditProductOptionForm({ option }: { option: AdminProductOption }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useEditProductOptionForm(option, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Edit Product Option</Trans>
            </RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="title">
              {(field) => <field.TextField label={t`Title`} autoFocus placeholder={t`e.g. Color, Size`} />}
            </form.AppField>
            <div>
              <h2 className="mb-2 font-medium text-sm">
                <Trans>Values</Trans>
              </h2>
              <form.Field name="values">
                {(field) => (
                  <TagInput
                    value={(field.state.value ?? []).map((v) => ({ id: v.value, label: v.value }))}
                    onChange={(items) => field.handleChange(items.map((item, rank) => ({ value: item.label, rank })))}
                    placeholder={t`Type a value and press Enter`}
                  />
                )}
              </form.Field>
            </div>
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
