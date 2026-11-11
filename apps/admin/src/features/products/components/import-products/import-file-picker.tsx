import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@proteus/ui'
import { FileTextIcon } from 'lucide-react'
import { useState } from 'react'
import type { AcceptedFormat } from '#/components/common/file-upload/constants'
import { FileUpload } from '#/components/common/file-upload/file-upload'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { formatFileSize } from '#/lib/format-file-size.ts'

type ImportFilePickerProps = {
  value: File | null
  onValueChange: (file: File | null) => void
  errors?: readonly unknown[]
  /** What the drop zone takes: matched by extension or type, since browsers often report no type. */
  formats: AcceptedFormat[]
  maxFileSize: number
  /** Under the drop zone, naming what it accepts and how large. */
  hint: (maxSize: string) => string
  /** Shown when the picked file is not one of `formats`. */
  notAccepted: string
}

/** One import file: the drop zone until a file is picked, then the file with a way to swap it. */
export function ImportFilePicker({
  value,
  onValueChange,
  errors,
  formats,
  maxFileSize,
  hint,
  notAccepted,
}: ImportFilePickerProps) {
  const { t, i18n } = useLingui()
  const [rejection, setRejection] = useState<string | null>(null)
  const maxSize = formatFileSize(maxFileSize, i18n, 0)

  const handleUploaded = (files: { file: File }[], rejected: { file: File }[]) => {
    const [picked] = files
    if (rejected.length > 0 || !picked) {
      setRejection(t`The file exceeds the maximum file size of ${maxSize}.`)
      return
    }
    // Browsers that cannot tell what a file is report no type at all; the server reads it either way.
    const name = picked.file.name.toLowerCase()
    const isAccepted = formats.some((format) => name.endsWith(format.extension) || picked.file.type === format.mimeType)
    if (!isAccepted) {
      setRejection(notAccepted)
      return
    }
    setRejection(null)
    onValueChange(picked.file)
  }

  return (
    <div className="flex flex-col gap-y-2">
      {value ? (
        <div className="flex items-center gap-x-3 rounded-lg border p-3">
          <FileTextIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-sm">{value.name}</span>
            <span className="text-muted-foreground text-xs">{formatFileSize(value.size, i18n)}</span>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => onValueChange(null)}>
            <Trans>Replace file</Trans>
          </Button>
        </div>
      ) : (
        <FileUpload
          multiple={false}
          label={t`Add file`}
          hint={hint(maxSize)}
          hasError={!!rejection || !!errors?.length}
          // The extension too: an app may register its own type for these files.
          formats={formats.flatMap((format) => [format.mimeType, format.extension])}
          maxFileSize={maxFileSize}
          onUploaded={handleUploaded}
        />
      )}
      {rejection ? (
        <TranslatedFieldError errors={[rejection]} />
      ) : (
        !!errors?.length && <TranslatedFieldError errors={errors} />
      )}
    </div>
  )
}
