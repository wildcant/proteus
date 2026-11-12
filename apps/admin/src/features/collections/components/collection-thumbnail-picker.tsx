import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Field, FieldDescription, FieldError, FieldLabel } from '@proteus/ui'
import { XIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { DEFAULT_MAX_FILE_SIZE, IMAGE_FORMATS } from '#/components/common/file-upload/constants'
import { FileUpload } from '#/components/common/file-upload/file-upload'
import type { CollectionThumbnail } from '#/features/collections/hooks/use-upload-collection-thumbnail'
import { formatFileSize } from '#/lib/format-file-size.ts'

type CollectionThumbnailPickerProps = {
  value: CollectionThumbnail | null
  onValueChange: (value: CollectionThumbnail | null) => void
}

/**
 * One image, the Collection page's hero. Picking a file only stages it with a blob preview; the
 * form uploads it on save, so a cancelled form leaves nothing behind in storage.
 */
export function CollectionThumbnailPicker({ value, onValueChange }: CollectionThumbnailPickerProps) {
  const { t, i18n } = useLingui()
  const id = useId()
  const [rejection, setRejection] = useState<string | null>(null)

  const handleUploaded = (files: { url: string; file: File }[], rejected: { file: File }[]) => {
    const [picked] = files
    if (rejected.length > 0 || !picked) {
      const maxSize = formatFileSize(DEFAULT_MAX_FILE_SIZE, i18n)
      setRejection(t`The image exceeds the maximum file size of ${maxSize}.`)
      return
    }
    if (!IMAGE_FORMATS.some((format) => format.mimeType === picked.file.type)) {
      const extensions = IMAGE_FORMATS.map((format) => format.extension).join(', ')
      setRejection(t`Not a supported image. Supported file types are: ${extensions}.`)
      return
    }
    setRejection(null)
    onValueChange({ url: picked.url, file: picked.file })
  }

  return (
    <Field data-invalid={!!rejection}>
      <FieldLabel htmlFor={id}>
        <Trans>Thumbnail</Trans>
      </FieldLabel>
      <FieldDescription>
        <Trans>Shown at the top of the collection page.</Trans>
      </FieldDescription>
      {value ? (
        <div className="flex items-center gap-x-3">
          <img src={value.url} alt="" className="size-20 shrink-0 rounded-md border object-cover" />
          <Button type="button" variant="secondary" size="sm" onClick={() => onValueChange(null)}>
            <XIcon />
            <Trans>Remove</Trans>
          </Button>
        </div>
      ) : (
        <FileUpload
          id={id}
          multiple={false}
          label={t`Upload an image`}
          hint={t`Drag and drop an image here or click to upload.`}
          hasError={!!rejection}
          formats={IMAGE_FORMATS.map((format) => format.mimeType)}
          onUploaded={handleUploaded}
        />
      )}
      {!!rejection && <FieldError>{rejection}</FieldError>}
    </Field>
  )
}
