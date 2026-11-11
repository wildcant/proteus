import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal } from '@proteus/ui'
import type { AdminProductImport, AdminProductImportError } from '#/api/generated/model'
import { CSV_FORMATS, CSV_MAX_FILE_SIZE } from '#/components/common/file-upload/constants'
import { ImportErrorList } from '#/features/products/components/import-products/import-error-list'
import { ImportFilePicker } from '#/features/products/components/import-products/import-file-picker'
import { useUploadProductImportForm } from '#/features/products/hooks/use-upload-product-import-form'

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
                  Import a CSV file in the Shopify product format, one row per variant. Tag a product{' '}
                  <code>categoria:handle</code> or <code>coleccion:handle</code> to place it in a category or
                  collection.
                </Trans>{' '}
                <a href="/product-import-template.csv" download className="text-primary hover:underline">
                  <Trans>Download sample CSV</Trans>
                </a>
              </p>
            </div>

            <form.Field name="file">
              {(field) => (
                <ImportFilePicker
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  errors={field.state.meta.isValid ? undefined : field.state.meta.errors}
                  formats={CSV_FORMATS}
                  maxFileSize={CSV_MAX_FILE_SIZE}
                  hint={(maxSize) => t`Accepts .csv up to ${maxSize}`}
                  notAccepted={t`Not a CSV file. Choose a file ending in .csv.`}
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
