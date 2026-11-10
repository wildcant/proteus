import { Trans, useLingui } from '@lingui/react/macro'
import { KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { useCreateProductTypeForm } from '#/features/product-types/hooks/use-create-product-type-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function CreateProductTypeForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useCreateProductTypeForm({
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
                  <Trans>Create Type</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>Name what a product is. A product has one type.</Trans>
                </p>
              </div>
              <form.AppField name="value">
                {(field) => <field.TextField label={t`Value`} autoFocus placeholder={t`e.g. T-shirt`} />}
              </form.AppField>
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
