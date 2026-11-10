import { Trans, useLingui } from '@lingui/react/macro'
import { ProductCategoriesPicker } from '#/features/categories/components/product-categories-picker'
import { CollectionsCombobox } from '#/features/collections/components/collections-combobox'
import { ProductTagsCombobox } from '#/features/product-tags/components/product-tags-combobox'
import { ProductTypeCombobox } from '#/features/product-types/components/product-type-combobox'
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
                <form.AppField name="organize.type">
                  {() => <ProductTypeCombobox description={t`What the product is, such as T-shirt or Sneakers.`} />}
                </form.AppField>
                <form.AppField name="organize.categoryIds">
                  {() => <ProductCategoriesPicker description={t`Where the product is listed on the store.`} />}
                </form.AppField>
                <form.AppField name="organize.collectionIds">
                  {() => <CollectionsCombobox description={t`A product can sit in several collections.`} />}
                </form.AppField>
                <form.AppField name="organize.tagIds">
                  {() => <ProductTagsCombobox description={t`Keywords shoppers can filter products by.`} />}
                </form.AppField>
              </div>
            </div>
          </>
        )}
      </form.FormGroup>
    )
  },
})
