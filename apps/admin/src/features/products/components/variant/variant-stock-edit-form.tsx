import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal, toast, useRouteModal } from '@proteus/ui'
import type { AdminProductVariantResponseVariant } from '#/api/generated/model'
import { useEditVariantStockForm } from '#/features/products/hooks/use-edit-variant-stock-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function VariantStockEditForm({
  productId,
  variant,
}: {
  productId: string
  variant: AdminProductVariantResponseVariant
}) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { form } = useEditVariantStockForm(productId, variant, {
    onSuccess: () => {
      toast.add({ type: 'success', title: t`Variant stock updated successfully` })
      handleSuccess()
    },
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
                  <Trans>Edit stock</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>Set the absolute Stocked Quantity. Units reserved by open orders cannot be removed.</Trans>
                </p>
              </div>
              <form.AppField name="stockedQuantity">
                {(field) => <field.NumberField label={t`Stocked quantity`} autoFocus />}
              </form.AppField>
            </div>
          </RouteFocusModal.Body>
          <RouteFocusModal.Footer>
            <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteFocusModal.Close>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
