import { Trans, useLingui } from '@lingui/react/macro'
import { KeyboundForm, RouteFocusModal, TagInput, useRouteModal } from '@proteus/ui'
import { useCreateProductOptionForm } from '#/features/product-options/hooks/use-create-product-option-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function CreateProductOptionForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useCreateProductOptionForm({
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header closeLabel={closeLabel} />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">
                  <Trans>Create Option</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>Create a new product option with values.</Trans>
                </p>
              </div>
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
            </div>
          </RouteFocusModal.Body>
          <RouteFocusModal.Footer>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
