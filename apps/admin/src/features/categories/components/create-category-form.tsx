import { Trans, useLingui } from '@lingui/react/macro'
import { KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { useCreateCategoryForm } from '#/features/categories/hooks/use-create-category-form'
import { flattenCategoryTree } from '#/features/categories/utils/flatten-category-tree'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function CreateCategoryForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { data } = useSuspenseCategoryTree()

  const { form } = useCreateCategoryForm({
    onSuccess: () => handleSuccess(),
  })

  // Names repeat across the tree ("Tops" under Men and under Women), so each option shows its path.
  const parents = flattenCategoryTree(data.productCategories).map(({ category, ancestors }) => ({
    id: category.id,
    label: [...ancestors, category.name].join(' › '),
  }))

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header closeLabel={closeLabel} />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">
                  <Trans>Create Category</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>Group products into a tree that shoppers browse.</Trans>
                </p>
              </div>
              <form.AppField name="name">
                {(field) => <field.TextField label={t`Name`} autoFocus placeholder={t`e.g. Tops`} />}
              </form.AppField>
              <form.AppField name="handle">
                {(field) => <field.TextField label={t`Handle`} placeholder={t`Generated from the name when blank`} />}
              </form.AppField>
              <form.AppField name="description">
                {(field) => <field.TextareaField label={t`Description`} rows={3} />}
              </form.AppField>
              <form.AppField name="parent">
                {(field) => (
                  <field.SingleComboboxField
                    label={t`Parent`}
                    items={parents}
                    placeholder={t`None — a top-level category`}
                    emptyMessage={t`No categories yet.`}
                    description={t`Fixed once the category is created.`}
                  />
                )}
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
