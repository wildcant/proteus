import { Plural, Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  RouteFocusModal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useRouteModal,
} from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import { InfoIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AdminImportedProduct, AdminProductImport } from '#/api/generated/model'
import { useCancelProductImport, useConfirmProductImport } from '#/features/products/api/product-imports'
import { productStatusLabels } from '#/features/products/utils/product-status'
import { activeLocale } from '#/lib/i18n/locale'

type ImportPreviewStepProps = {
  productImport: AdminProductImport
  onConfirmed: () => void
}

/** Step two: what the file will do, and its first product as it will be imported. */
export function ImportPreviewStep({ productImport, onConfirmed }: ImportPreviewStepProps) {
  const { handleSuccess } = useRouteModal()
  const confirm = useConfirmProductImport(productImport.id)
  const cancel = useCancelProductImport(productImport.id)
  const { summary } = productImport
  const ignoredColumns = summary.ignoredColumns.join(', ')
  const isPending = confirm.isPending || cancel.isPending

  return (
    <>
      <RouteFocusModal.Body>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-y-6 px-6 py-8">
          <h1 className="font-medium text-xl">
            <Trans>Preview your first product</Trans>
          </h1>

          <p className="flex items-start gap-x-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-blue-500 dark:text-blue-400" aria-hidden="true" />
            <Trans>Check that the first product reads the way you expect before importing the whole file.</Trans>
          </p>

          <ImportSummary productImport={productImport} />

          <WillCreate willCreate={summary.willCreate} />

          {summary.ignoredColumns.length > 0 && (
            <section className="flex flex-col gap-y-1">
              <h2 className="font-medium text-sm">
                <Trans>Ignored columns</Trans>
              </h2>
              <p className="text-muted-foreground text-sm">
                <Trans>These columns are not imported: {ignoredColumns}</Trans>
              </p>
            </section>
          )}

          {summary.firstProduct ? (
            <FirstProduct product={summary.firstProduct} metafields={summary.metafields} />
          ) : null}
        </div>
      </RouteFocusModal.Body>

      <RouteFocusModal.Footer>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={() => cancel.mutate(undefined, { onSuccess: () => handleSuccess() })}
        >
          <Trans>Cancel</Trans>
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => confirm.mutate(undefined, { onSuccess: onConfirmed })}
        >
          <Trans>Import products</Trans>
        </Button>
      </RouteFocusModal.Footer>
    </>
  )
}

function ImportSummary({ productImport }: { productImport: AdminProductImport }) {
  const { summary, options } = productImport
  const { create, update, skip } = summary.products
  const { skus, images } = summary
  const total = create + update + skip

  return (
    <div className="flex flex-col gap-y-2 text-sm">
      <p>
        <Trans>
          You will be importing approximately{' '}
          <strong>
            <Plural value={total} one="# product" other="# products" />
          </strong>{' '}
          with a total of{' '}
          <strong>
            <Plural value={skus} one="# SKU" other="# SKUs" />
          </strong>{' '}
          and{' '}
          <strong>
            <Plural value={images} one="# image" other="# images" />
          </strong>
          .
        </Trans>
      </p>
      <p className="text-muted-foreground">
        <Trans>
          {create} new, {update} to update, {skip} skipped.
        </Trans>
      </p>
      <p>
        {options.overwrite ? (
          <Trans>
            Importing will <strong>overwrite existing products</strong> that have the same product handle.
          </Trans>
        ) : (
          <Trans>
            Importing will <strong>not overwrite any existing products</strong> that have the same product handle.
          </Trans>
        )}{' '}
        {options.publish ? (
          <Trans>
            New products will be <strong>published</strong>.
          </Trans>
        ) : (
          <Trans>
            New products will be saved as <strong>drafts</strong>.
          </Trans>
        )}
      </p>
    </div>
  )
}

function WillCreate({ willCreate }: { willCreate: AdminProductImport['summary']['willCreate'] }) {
  const { t } = useLingui()
  const groups = [
    { label: t`Tags`, values: willCreate.tags },
    { label: t`Types`, values: willCreate.types },
  ].filter((group) => group.values.length > 0)

  if (groups.length === 0) return null

  return (
    <section className="flex flex-col gap-y-2">
      <h2 className="font-medium text-sm">
        <Trans>This import will create</Trans>
      </h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        {groups.map((group) => (
          <FieldRow key={group.label} label={group.label}>
            {group.values.join(', ')}
          </FieldRow>
        ))}
      </dl>
    </section>
  )
}

function FirstProduct({
  product,
  metafields,
}: {
  product: NonNullable<AdminImportedProduct>
  /** The file's metafield columns, which name each key the product's values are under. */
  metafields: AdminProductImport['summary']['metafields']
}) {
  const { t, i18n } = useLingui()
  const none = '—'
  const description = product.description ? plainText(product.description) : none

  return (
    <section className="flex flex-col gap-y-4">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <FieldRow label={t`Title`}>{product.title}</FieldRow>
        <FieldRow label={t`Description`}>
          <span className="line-clamp-3">{description}</span>
        </FieldRow>
        <FieldRow label={t`Status`}>
          <span className="capitalize">{i18n._(productStatusLabels[product.status])}</span>
        </FieldRow>
        <FieldRow label={t`Type`}>{product.type ?? none}</FieldRow>
        <FieldRow label={t`Tags`}>{product.tags.join(', ') || none}</FieldRow>
        {metafields.map(({ key, name }) => (
          <FieldRow key={key} label={name}>
            {product.metafields[key]?.join(', ') || none}
          </FieldRow>
        ))}
      </dl>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Trans>Variant</Trans>
              </TableHead>
              <TableHead>
                <Trans>SKU</Trans>
              </TableHead>
              <TableHead>
                <Trans>Weight</Trans>
              </TableHead>
              <TableHead>
                <Trans>Price</Trans>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {product.variants.map((variant) => (
              <TableRow key={variant.line}>
                <TableCell>{variant.optionValues.join(' / ') || t`Default`}</TableCell>
                <TableCell>{variant.sku ?? none}</TableCell>
                <TableCell>{variant.weight === null ? none : `${variant.weight} g`}</TableCell>
                <TableCell>
                  {variant.prices
                    .map((price) => formatPrice(String(price.amount), price.currencyCode, activeLocale()))
                    .join(' · ') || none}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

/** The description is HTML in the file; the preview shows what a shopper would read of it. */
function plainText(html: string) {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
}
