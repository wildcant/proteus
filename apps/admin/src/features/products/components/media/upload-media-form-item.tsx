import { IMAGE_FORMATS } from '#/components/common/file-upload'
import { FileUploadField } from '#/components/form/file-upload-field.tsx'
import type { ProductMedia } from '#/features/products/utils/media'

type UploadMediaFormItemProps = {
  showHint?: boolean
}

/** Renders inside a `media` array field — see `FileUploadField` for the field contract. */
export function UploadMediaFormItem({ showHint = true }: UploadMediaFormItemProps) {
  return (
    <FileUploadField<ProductMedia>
      label="Media"
      description={showHint ? 'Add media to the product to showcase it in your storefront.' : undefined}
      uploadLabel="Upload images"
      uploadHint="Drag and drop images here or click to upload."
      formats={IMAGE_FORMATS}
      toValue={(file) => ({ key: file.id, url: file.url, file: file.file, isThumbnail: false })}
    />
  )
}
