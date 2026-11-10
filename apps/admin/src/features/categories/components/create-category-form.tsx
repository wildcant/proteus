import { Trans, useLingui } from '@lingui/react/macro'
import { Field, FieldDescription, FieldLabel, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { useId } from 'react'
import { useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { CategoryPicker } from '#/features/categories/components/category-picker'
import { useCreateCategoryForm } from '#/features/categories/hooks/use-create-category-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function CreateCategoryForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { data } = useSuspenseCategoryTree()
  const parentId = useId()

  const { form } = useCreateCategoryForm({
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
              <form.Field name="parentId">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={parentId}>
                      <Trans>Parent</Trans>
                    </FieldLabel>
                    <CategoryPicker
                      multiple={false}
                      id={parentId}
                      tree={data.productCategories}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    />
                    <FieldDescription>
                      <Trans>None makes it a top-level category. Fixed once the category is created.</Trans>
                    </FieldDescription>
                  </Field>
                )}
              </form.Field>
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
