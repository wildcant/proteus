import { Trans, useLingui } from '@lingui/react/macro'
import { Field, FieldDescription, FieldLabel } from '@proteus/ui'
import { useId } from 'react'
import { useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { CategoryPicker } from '#/features/categories/components/category-picker'
import { useSuspenseAllCollections } from '#/features/collections/api/collections'
import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import { type GroupRefs, Tab } from './constants'
import { RegisterCreateProductFormStep } from './register-create-product-form-step'
import { organizeSchema } from './schemas'

export const ProductCreateOrganizeForm = withForm({
  ...productCreateFormOpts,
  props: { groupRefs: {} as GroupRefs },
  render: function ProductCreateOrganizeForm({ form, groupRefs }) {
    const { t } = useLingui()
    const { data: tree } = useSuspenseCategoryTree()
    const { data: collections } = useSuspenseAllCollections()
    const categoriesId = useId()

    return (
      <form.FormGroup name="organize" validators={{ onSubmit: organizeSchema }}>
        {(formGroup) => (
          <>
            <RegisterCreateProductFormStep groupRefs={groupRefs} tab={Tab.ORGANIZE} formGroup={formGroup} />
            <div className="flex flex-col gap-y-8">
              <h2 className="font-semibold text-xl">
                <Trans>Organize</Trans>
              </h2>
              <div className="flex flex-col gap-y-4">
                <form.AppField name="organize.discountable">
                  {(f) => (
                    <f.CheckboxField
                      label={t`Discountable`}
                      description={t`When unchecked, discounts will not apply to this product.`}
                    />
                  )}
                </form.AppField>
                <form.Field name="organize.categoryIds">
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
                      <FieldDescription>
                        <Trans>Where the product is listed on the store.</Trans>
                      </FieldDescription>
                    </Field>
                  )}
                </form.Field>
                <form.AppField name="organize.collectionIds">
                  {(field) => (
                    <field.MultiComboboxField
                      label={t`Collections`}
                      items={collections.map((collection) => ({ id: collection.id, label: collection.title }))}
                      placeholder={t`Choose collections`}
                      emptyMessage={t`No collections yet.`}
                      description={t`A product can sit in several collections.`}
                    />
                  )}
                </form.AppField>
              </div>
            </div>
          </>
        )}
      </form.FormGroup>
    )
  },
})
