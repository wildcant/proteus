import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import { StagedMediaList } from '../media/staged-media-list'
import { UploadMediaFormItem } from '../media/upload-media-form-item'

export const ProductCreateMediaSection = withForm({
  ...productCreateFormOpts,
  render: function ProductCreateMediaSection({ form }) {
    return (
      <div className="flex flex-col gap-y-4">
        <h2 className="font-semibold text-xl">Media</h2>
        <form.AppField name="media">{() => <UploadMediaFormItem showHint={false} />}</form.AppField>
        <form.Field name="media">
          {(field) => <StagedMediaList media={field.state.value} onChange={field.handleChange} />}
        </form.Field>
      </div>
    )
  },
})
