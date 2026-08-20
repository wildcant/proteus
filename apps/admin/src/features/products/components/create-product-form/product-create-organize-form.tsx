import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import { type GroupRefs, Tab } from './constants'
import { organizeSchema } from './schemas'
import { useRegisterCreateProductFormStep } from './use-register-create-product-form-step'

export const ProductCreateOrganizeForm = withForm({
  ...productCreateFormOpts,
  props: { groupRefs: {} as GroupRefs },
  render: function ProductCreateOrganizeForm({ form, groupRefs }) {
    return (
      <form.FormGroup name="organize" validators={{ onSubmit: organizeSchema }}>
        {(formGroup) => {
          useRegisterCreateProductFormStep(groupRefs, Tab.ORGANIZE, formGroup)

          return (
            <div className="flex flex-col gap-y-8">
              <h2 className="font-semibold text-xl">Organize</h2>
              <div className="flex flex-col gap-y-4">
                <form.AppField name="organize.discountable">
                  {(f) => (
                    <f.CheckboxField
                      label="Discountable"
                      description="When unchecked, discounts will not apply to this product."
                    />
                  )}
                </form.AppField>
              </div>
            </div>
          )
        }}
      </form.FormGroup>
    )
  },
})
