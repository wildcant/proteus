import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import { type GroupRefs, Tab } from './constants'
import { ProductCreateMediaSection } from './product-create-details-media-section'
import { ProductCreateVariantsSection } from './product-create-variants-section'
import { RegisterCreateProductFormStep } from './register-create-product-form-step'
import { detailsSchema } from './schemas'

export const ProductCreateDetailsForm = withForm({
  ...productCreateFormOpts,
  props: { groupRefs: {} as GroupRefs },
  render: function ProductCreateDetailsForm({ form, groupRefs }) {
    return (
      <form.FormGroup name="details" validators={{ onSubmit: detailsSchema }}>
        {(formGroup) => (
          <>
            <RegisterCreateProductFormStep groupRefs={groupRefs} tab={Tab.DETAILS} formGroup={formGroup} />
            <div className="flex flex-col gap-y-8">
              <h2 className="font-semibold text-xl">General</h2>
              <div className="flex flex-col gap-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <form.AppField name="details.title">
                    {(form) => <form.TextField label="Title" autoFocus />}
                  </form.AppField>
                  <form.AppField name="details.subtitle">{(form) => <form.TextField label="Subtitle" />}</form.AppField>
                  <form.AppField name="details.handle">{(form) => <form.TextField label="Handle" />}</form.AppField>
                </div>
                <form.AppField name="details.description">
                  {(form) => <form.TextareaField label="Description" />}
                </form.AppField>
              </div>
              <ProductCreateMediaSection form={form} />
              <ProductCreateVariantsSection form={form} />
            </div>
          </>
        )}
      </form.FormGroup>
    )
  },
})
