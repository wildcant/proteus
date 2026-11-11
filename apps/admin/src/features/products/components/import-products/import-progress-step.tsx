import { Trans, useLingui } from '@lingui/react/macro'
import { Button, RouteFocusModal } from '@proteus/ui'
import { useSuspenseProductImport } from '#/features/products/api/product-imports'
import { ImportErrorList } from '#/features/products/components/import-products/import-error-list'

/**
 * Step three: the import running in the background. The job is polled while it imports, so this is
 * also what a merchant opening the finished notification lands on.
 */
export function ImportProgressStep({ productImportId }: { productImportId: string }) {
  const { t } = useLingui()
  const { data } = useSuspenseProductImport(productImportId)
  const { productImport } = data
  const { create, update, skip } = productImport.summary.products
  const total = create + update + skip
  const processed = productImport.created + productImport.updated + productImport.skipped + productImport.failed
  const isImporting = productImport.status === 'importing'
  const percent = total === 0 ? 100 : Math.min(100, Math.round((processed / total) * 100))

  const heading = isImporting
    ? t`Importing products`
    : productImport.status === 'failed'
      ? t`Import failed`
      : t`Import finished`

  const counters = [
    { label: t`Created`, value: productImport.created },
    { label: t`Updated`, value: productImport.updated },
    { label: t`Skipped`, value: productImport.skipped },
    { label: t`Failed`, value: productImport.failed },
  ]

  return (
    <>
      <RouteFocusModal.Body>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-y-6 px-6 py-8">
          <h1 className="font-medium text-xl">{heading}</h1>

          <div className="flex flex-col gap-y-2">
            <div
              role="progressbar"
              aria-label={t`Import progress`}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={processed}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-muted-foreground text-sm">
              <Trans>
                {processed} of {total} products processed
              </Trans>
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counters.map((counter) => (
              <div key={counter.label} className="rounded-lg border p-3">
                <dt className="text-muted-foreground text-xs">{counter.label}</dt>
                <dd className="font-medium text-lg tabular-nums">{counter.value}</dd>
              </div>
            ))}
          </dl>

          {productImport.errors.length > 0 && (
            <section className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <h2 className="font-medium text-destructive text-sm">
                <Trans>These products were not imported</Trans>
              </h2>
              <ImportErrorList errors={productImport.errors} />
            </section>
          )}

          {isImporting && (
            <p className="text-muted-foreground text-sm">
              <Trans>You can close this window — you'll get a notification when it finishes.</Trans>
            </p>
          )}
        </div>
      </RouteFocusModal.Body>

      <RouteFocusModal.Footer>
        <RouteFocusModal.Close render={<Button size="sm" />}>
          <Trans>Done</Trans>
        </RouteFocusModal.Close>
      </RouteFocusModal.Footer>
    </>
  )
}
