import { Trans } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { useEditCategoryProductsForm } from '#/features/categories/hooks/use-edit-category-products-form'
import { ProductPicker } from '#/features/products/components/product-picker'
import { useUiCopy } from '#/hooks/use-ui-copy'

type EditCategoryProductsFormProps = {
  categoryId: string
  categoryName: string
  memberIds: string[]
}

export function EditCategoryProductsForm({ categoryId, categoryName, memberIds }: EditCategoryProductsFormProps) {
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useEditCategoryProductsForm(categoryId, memberIds, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header closeLabel={closeLabel} />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">
                  <Trans>Products in {categoryName}</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>Check a product to add it, uncheck one to remove it.</Trans>
                </p>
              </div>
              <form.Field name="productIds">
                {(field) => <ProductPicker value={field.state.value} onValueChange={field.handleChange} />}
              </form.Field>
            </div>
          </RouteFocusModal.Body>
          <RouteFocusModal.Footer>
            <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteFocusModal.Close>
            <form.SubmitButton size="sm">
              <Trans>Done</Trans>
            </form.SubmitButton>
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
