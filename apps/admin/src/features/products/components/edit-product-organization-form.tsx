import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Field, FieldLabel, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { useId } from 'react'
import type { AdminGroupedProduct } from '#/api/generated/model'
import { useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { CategoryPicker } from '#/features/categories/components/category-picker'
import { useSuspenseAllCollections } from '#/features/collections/api/collections'
import { useProductTagOptions } from '#/features/product-tags/hooks/use-product-tag-options'
import { useProductTypeOptions } from '#/features/product-types/hooks/use-product-type-options'
import { useEditProductOrganizationForm } from '#/features/products/hooks/use-edit-product-organization-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditProductOrganizationForm({ product }: { product: AdminGroupedProduct }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { data: tree } = useSuspenseCategoryTree()
  const { data: collections } = useSuspenseAllCollections()
  const { options: typeOptions, createOption: createTypeOption } = useProductTypeOptions()
  const { options: tagOptions, createOption: createTagOption } = useProductTagOptions()
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
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="type">
              {(field) => (
                <field.SingleComboboxField
                  label={t`Type`}
                  items={typeOptions}
                  onCreate={createTypeOption}
                  placeholder={t`Search or add a type`}
                  emptyMessage={t`Type to add one.`}
                />
              )}
            </form.AppField>
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
            <form.AppField name="collectionIds">
              {(field) => (
                <field.MultiComboboxField
                  label={t`Collections`}
                  items={collections.map((collection) => ({ id: collection.id, label: collection.title }))}
                  placeholder={t`Choose collections`}
                  emptyMessage={t`No collections yet.`}
                />
              )}
            </form.AppField>
            <form.AppField name="tagIds">
              {(field) => (
                <field.MultiComboboxField
                  label={t`Tags`}
                  items={tagOptions}
                  onCreate={createTagOption}
                  placeholder={t`Search or add tags`}
                  emptyMessage={t`Type to add a tag.`}
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
