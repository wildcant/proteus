import { Trans, useLingui } from '@lingui/react/macro'
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
              </div>
            </div>
          </>
        )}
      </form.FormGroup>
    )
  },
})
