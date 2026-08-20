import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import { type GroupRefs, Tab } from './constants'
import { attributesSchema } from './schemas'
import { useRegisterCreateProductFormStep } from './use-register-create-product-form-step'

export const ProductCreateAttributesForm = withForm({
  ...productCreateFormOpts,
  props: { groupRefs: {} as GroupRefs },
  render: function ProductCreateAttributesForm({ form, groupRefs }) {
    return (
      <form.FormGroup name="attributes" validators={{ onSubmit: attributesSchema }}>
        {(formGroup) => {
          useRegisterCreateProductFormStep(groupRefs, Tab.ATTRIBUTES, formGroup)

          return (
            <div className="flex flex-col gap-y-8">
              <h2 className="font-semibold text-xl">Attributes</h2>
              <div className="flex flex-col gap-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <form.AppField name="attributes.material">
                    {(form) => <form.TextField label="Material" />}
                  </form.AppField>
                  <form.AppField name="attributes.originCountry">
                    {(form) => <form.TextField label="Country of Origin" />}
                  </form.AppField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <form.AppField name="attributes.hsCode">{(form) => <form.TextField label="HS Code" />}</form.AppField>
                  <form.AppField name="attributes.midCode">
                    {(form) => <form.TextField label="MID Code" />}
                  </form.AppField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <form.AppField name="attributes.weight">
                    {(form) => <form.NumberField label="Weight" />}
                  </form.AppField>
                  <form.AppField name="attributes.length">
                    {(form) => <form.NumberField label="Length" />}
                  </form.AppField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <form.AppField name="attributes.height">
                    {(form) => <form.NumberField label="Height" />}
                  </form.AppField>
                  <form.AppField name="attributes.width">{(form) => <form.NumberField label="Width" />}</form.AppField>
                </div>
              </div>
            </div>
          )
        }}
      </form.FormGroup>
    )
  },
})
