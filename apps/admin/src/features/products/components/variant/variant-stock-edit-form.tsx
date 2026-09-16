import { Button, KeyboundForm, RouteFocusModal, toast, useRouteModal } from '@proteus/ui'
import type { AdminProductVariantResponseVariant } from '#/api/generated/model'
import { useEditVariantStockForm } from '#/features/products/hooks/use-edit-variant-stock-form'

export function VariantStockEditForm({
  productId,
  variant,
}: {
  productId: string
  variant: AdminProductVariantResponseVariant
}) {
  const { handleSuccess } = useRouteModal()
  const { form } = useEditVariantStockForm(productId, variant, {
    onSuccess: () => {
      toast.add({ type: 'success', title: 'Variant stock updated successfully' })
      handleSuccess()
    },
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">Edit stock</h1>
                <p className="text-muted-foreground text-sm">
                  Set the absolute Stocked Quantity. Units reserved by open orders cannot be removed.
                </p>
              </div>
              <form.AppField name="stockedQuantity">
                {(field) => <field.NumberField label="Stocked quantity" autoFocus />}
              </form.AppField>
            </div>
          </RouteFocusModal.Body>
          <RouteFocusModal.Footer>
            <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
            <form.SubmitButton size="sm">Save</form.SubmitButton>
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
