import { Field, FieldDescription, FieldError, FieldLabel } from '@proteus/ui'
import { useId } from 'react'
import {
  type AcceptedFormat,
  DEFAULT_MAX_FILE_SIZE,
  type FileType,
  FileUpload,
  type RejectedFile,
} from '#/components/common/file-upload'
import { useFieldContext } from '#/lib/form-context.ts'
import { formatFileSize } from '#/lib/format-file-size.ts'

type FileUploadFieldProps<TValue> = {
  label: string
  description?: string
  uploadLabel: string
  uploadHint?: string
  formats: AcceptedFormat[]
  maxFileSize?: number
  /** Maps an accepted file to the value appended to this field's array. */
  toValue: (file: FileType) => TValue
}

export function FileUploadField<TValue>({
  label,
  description,
  uploadLabel,
  uploadHint,
  formats,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  toValue,
}: FileUploadFieldProps<TValue>) {
  const field = useFieldContext<TValue[]>()
  const id = useId()

  // Unlike the text fields, rejections are set imperatively on drop rather than by a
  // validator, so there is no touched state to gate them behind.
  const isInvalid = !field.state.meta.isValid

  const getRejectionMessage = (files: FileType[], rejectedFiles: RejectedFile[]) => {
    const invalidFile = files.find((f) => !formats.some((format) => format.mimeType === f.file.type))
    if (invalidFile) {
      const extensions = formats.map((format) => format.extension).join(', ')
      return `'${invalidFile.file.name}' is not a supported file type. Supported file types are: ${extensions}.`
    }

    const oversizedFiles = rejectedFiles.filter((f) => f.reason === 'size')
    if (!oversizedFiles.length) {
      return null
    }

    const names = oversizedFiles
      .slice(0, 5)
      .map((f) => f.file.name)
      .join('\n')

    return `One or more files exceed the maximum file size of ${formatFileSize(maxFileSize)}:\n${names}`
  }

  const handleUploaded = (files: FileType[], rejectedFiles: RejectedFile[]) => {
    field.setErrorMap({ onChange: undefined })

    // A single unusable file rejects the whole drop, so the user re-picks a clean set
    // instead of having to work out which of the staged files actually made it through.
    const rejectionMessage = getRejectionMessage(files, rejectedFiles)
    if (rejectionMessage) {
      field.setErrorMap({ onChange: [{ message: rejectionMessage }] })
      return
    }

    for (const file of files) {
      field.pushValue(toValue(file))
    }
  }

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {!!description && <FieldDescription>{description}</FieldDescription>}
      <FileUpload
        id={id}
        label={uploadLabel}
        hint={uploadHint}
        hasError={isInvalid}
        formats={formats.map((format) => format.mimeType)}
        maxFileSize={maxFileSize}
        onUploaded={handleUploaded}
      />
      {!!isInvalid && <FieldError className="whitespace-pre-line" errors={field.state.meta.errors} />}
    </Field>
  )
}
