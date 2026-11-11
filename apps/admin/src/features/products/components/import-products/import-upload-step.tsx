import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal } from '@proteus/ui'
import { FileTextIcon } from 'lucide-react'
import { useState } from 'react'
import type { AdminProductImport, AdminProductImportError } from '#/api/generated/model'
import { CSV_FORMATS, CSV_MAX_FILE_SIZE } from '#/components/common/file-upload/constants'
import { FileUpload } from '#/components/common/file-upload/file-upload'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { ImportErrorList } from '#/features/products/components/import-products/import-error-list'
import { useUploadProductImportForm } from '#/features/products/hooks/use-upload-product-import-form'
import { formatFileSize } from '#/lib/format-file-size.ts'

type ImportUploadStepProps = {
  /** What the last file was refused for. Empty until a file comes back with problems. */
  errors: AdminProductImportError[]
  onRead: (productImport: AdminProductImport) => void
}

/** Step one: pick the CSV and how it is applied. A file with problems stays here with every one listed. */
export function ImportUploadStep({ errors, onRead }: ImportUploadStepProps) {
  const { t } = useLingui()
  const { form } = useUploadProductImportForm({ onSuccess: onRead })

  return (
    <KeyboundForm onSubmit={form.handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <form.AppForm>
        <RouteFocusModal.Body>
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-y-6 px-6 py-8">
            <h1 className="font-medium text-xl">
              <Trans>Import products</Trans>
            </h1>

            {errors.length > 0 && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <h2 className="font-medium text-destructive text-sm">
                  <Trans>
                    There was an error importing your CSV file. After you fix the error, try importing the CSV file
                    again.
                  </Trans>
                </h2>
                <ImportErrorList errors={errors} />
              </div>
            )}

            <div className="flex flex-col gap-y-1">
              <h2 className="font-medium text-sm">
                <Trans>Bulk import via CSV</Trans>
              </h2>
              <p className="text-muted-foreground text-sm">
                <Trans>
                  Import a CSV file in the Shopify product format, one row per variant. Tags such as{' '}
                  <code>genero:hombre</code> are kept as written; the rules in the store structure use them to place
                  products in categories and collections.
                </Trans>{' '}
                <a href="/product-import-template.csv" download className="text-primary hover:underline">
                  <Trans>Download sample CSV</Trans>
                </a>
              </p>
            </div>

            <form.Field name="file">
              {(field) => (
                <CsvFilePicker
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  errors={field.state.meta.isValid ? undefined : field.state.meta.errors}
                />
              )}
            </form.Field>

            <div className="flex flex-col gap-y-4">
              <form.AppField name="overwrite">
                {(field) => (
                  <field.CheckboxField
                    label={t`Overwrite products with matching handles.`}
                    description={t`Existing values will be replaced for all columns included in the CSV.`}
                  />
                )}
              </form.AppField>
              <form.AppField name="publish">
                {(field) => <field.CheckboxField label={t`Publish new products.`} />}
              </form.AppField>
            </div>
          </div>
        </RouteFocusModal.Body>

        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
            <Trans>Cancel</Trans>
          </RouteFocusModal.Close>
          <form.SubmitButton size="sm">
            <Trans>Upload file</Trans>
          </form.SubmitButton>
        </RouteFocusModal.Footer>
      </form.AppForm>
    </KeyboundForm>
  )
}

type CsvFilePickerProps = {
  value: File | null
  onValueChange: (file: File | null) => void
  errors?: readonly unknown[]
}

/** One CSV: the drop zone until a file is picked, then the file with a way to swap it. */
function CsvFilePicker({ value, onValueChange, errors }: CsvFilePickerProps) {
  const { t, i18n } = useLingui()
  const [rejection, setRejection] = useState<string | null>(null)
  const maxSize = formatFileSize(CSV_MAX_FILE_SIZE, i18n, 0)

  const handleUploaded = (files: { file: File }[], rejected: { file: File }[]) => {
    const [picked] = files
    if (rejected.length > 0 || !picked) {
      setRejection(t`The file exceeds the maximum file size of ${maxSize}.`)
      return
    }
    // Browsers that cannot tell what a file is report no type at all; the server reads it either way.
    const isCsv = picked.file.name.toLowerCase().endsWith('.csv') || picked.file.type === 'text/csv'
    if (!isCsv) {
      setRejection(t`Not a CSV file. Choose a file ending in .csv.`)
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
          hint={t`Accepts .csv up to ${maxSize}`}
          hasError={!!rejection || !!errors?.length}
          // The extension too: a spreadsheet app may register its own type for .csv files.
          formats={CSV_FORMATS.flatMap((format) => [format.mimeType, format.extension])}
          maxFileSize={CSV_MAX_FILE_SIZE}
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
