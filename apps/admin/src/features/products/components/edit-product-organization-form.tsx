import { Trans } from '@lingui/react/macro'
import { Button, Field, FieldLabel, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { useId } from 'react'
import type { AdminGroupedProduct } from '#/api/generated/model'
import { useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { CategoryPicker } from '#/features/categories/components/category-picker'
import { useEditProductOrganizationForm } from '#/features/products/hooks/use-edit-product-organization-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditProductOrganizationForm({ product }: { product: AdminGroupedProduct }) {
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { data: tree } = useSuspenseCategoryTree()
  const categoriesId = useId()

  const { form } = useEditProductOrganizationForm(product, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Edit Organization</Trans>
            </RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body>
            <form.Field name="categoryIds">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={categoriesId}>
                    <Trans>Categories</Trans>
                  </FieldLabel>
                  <CategoryPicker
                    id={categoriesId}
                    tree={tree.productCategories}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  />
                </Field>
              )}
            </form.Field>
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
