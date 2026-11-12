import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal } from '@proteus/ui'
import type { AdminCatalogStructureError } from '#/api/generated/model'
import { YAML_FORMATS, YAML_MAX_FILE_SIZE } from '#/components/common/file-upload/constants'
import { ImportFilePicker } from '#/features/products/components/import-products/import-file-picker'
import {
  type PreviewedCatalogStructure,
  useUploadCatalogStructureForm,
} from '#/features/products/hooks/use-upload-catalog-structure-form'

type StructureUploadStepProps = {
  /** What the last file was refused for. Empty until a file comes back with problems. */
  errors: AdminCatalogStructureError[]
  onRead: (previewed: PreviewedCatalogStructure) => void
}

/** Step one: pick the structure file. A file with problems stays here with every one listed by its place in the file. */
export function StructureUploadStep({ errors, onRead }: StructureUploadStepProps) {
  const { t } = useLingui()
  const { form } = useUploadCatalogStructureForm({ onSuccess: onRead })

  return (
    <KeyboundForm onSubmit={form.handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <form.AppForm>
        <RouteFocusModal.Body>
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-y-6 px-6 py-8">
            <h1 className="font-medium text-xl">
              <Trans>Import structure</Trans>
            </h1>

            {errors.length > 0 && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <h2 className="font-medium text-destructive text-sm">
                  <Trans>The structure file has errors. After you fix them, try importing it again.</Trans>
                </h2>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground text-sm">
                  {errors.map(({ path, message }) => (
                    <li key={`${path}:${message}`}>
                      {path ? (
                        <>
                          <code>{path}</code>: {message}
                        </>
                      ) : (
                        message
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-y-1">
              <h2 className="font-medium text-sm">
                <Trans>Categories, collections and menu from a YAML file</Trans>
              </h2>
              <p className="text-muted-foreground text-sm">
                <Trans>
                  The file lists the product metafields as <code>campos</code>, then <code>categorias</code> with their{' '}
                  <code>hijos</code>, <code>colecciones</code> and the <code>menu</code>. A <code>regla</code> fills a
                  category or collection with the products whose metafields match, and <code>filtro: true</code> offers
                  a metafield as a storefront filter. The file is the source: metafields, categories and collections it
                  leaves out are deleted.
                </Trans>
              </p>
            </div>

            <form.Field name="file">
              {(field) => (
                <ImportFilePicker
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  errors={field.state.meta.isValid ? undefined : field.state.meta.errors}
                  formats={YAML_FORMATS}
                  maxFileSize={YAML_MAX_FILE_SIZE}
                  hint={(maxSize) => t`Accepts .yaml up to ${maxSize}`}
                  notAccepted={t`Not a YAML file. Choose a file ending in .yaml or .yml.`}
                />
              )}
            </form.Field>
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
