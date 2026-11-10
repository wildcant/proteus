import { Trans } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminGroupedProduct } from '#/api/generated/model'
import { ProductCategoriesPicker } from '#/features/categories/components/product-categories-picker'
import { CollectionsCombobox } from '#/features/collections/components/collections-combobox'
import { ProductTagsCombobox } from '#/features/product-tags/components/product-tags-combobox'
import { ProductTypeCombobox } from '#/features/product-types/components/product-type-combobox'
import { useEditProductOrganizationForm } from '#/features/products/hooks/use-edit-product-organization-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditProductOrganizationForm({ product }: { product: AdminGroupedProduct }) {
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

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
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="type">{() => <ProductTypeCombobox />}</form.AppField>
            <form.AppField name="categoryIds">{() => <ProductCategoriesPicker />}</form.AppField>
            <form.AppField name="collectionIds">{() => <CollectionsCombobox />}</form.AppField>
            <form.AppField name="tagIds">{() => <ProductTagsCombobox />}</form.AppField>
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
