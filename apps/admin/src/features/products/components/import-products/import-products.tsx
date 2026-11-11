import { Trans } from '@lingui/react/macro'
import { RouteFocusModal } from '@proteus/ui'
import { useState } from 'react'
import type { AdminProductImport, AdminProductImportError } from '#/api/generated/model'
import { ImportPreviewStep } from '#/features/products/components/import-products/import-preview-step'
import { ImportProgressStep } from '#/features/products/components/import-products/import-progress-step'
import { ImportUploadStep } from '#/features/products/components/import-products/import-upload-step'
import { useUiCopy } from '#/hooks/use-ui-copy'

/** The steps run one way: a refused file stays on upload, and only a clean preview can be confirmed. */
type ImportStep =
  | { step: 'upload'; errors: AdminProductImportError[] }
  | { step: 'preview'; productImport: AdminProductImport }
  | { step: 'importing'; productImportId: string }

/** Where a job already on file picks up — the notification links straight back to it. */
function resumeAt(productImport: AdminProductImport | undefined): ImportStep {
  if (!productImport) return { step: 'upload', errors: [] }
  if (productImport.status === 'previewed') return afterRead(productImport)
  if (productImport.status === 'canceled' || productImport.status === 'expired') return { step: 'upload', errors: [] }
  return { step: 'importing', productImportId: productImport.id }
}

function afterRead(productImport: AdminProductImport): ImportStep {
  if (productImport.errors.length > 0) return { step: 'upload', errors: productImport.errors }
  return { step: 'preview', productImport }
}

export function ImportProducts({ productImport }: { productImport?: AdminProductImport }) {
  const { closeLabel } = useUiCopy()
  const [state, setState] = useState<ImportStep>(() => resumeAt(productImport))

  return (
    <>
      <RouteFocusModal.Header closeLabel={closeLabel}>
        <RouteFocusModal.Title className="sr-only">
          <Trans>Import products</Trans>
        </RouteFocusModal.Title>
      </RouteFocusModal.Header>
      {state.step === 'upload' && (
        <ImportUploadStep errors={state.errors} onRead={(read) => setState(afterRead(read))} />
      )}
      {state.step === 'preview' && (
        <ImportPreviewStep
          productImport={state.productImport}
          onConfirmed={() => setState({ step: 'importing', productImportId: state.productImport.id })}
        />
      )}
      {state.step === 'importing' && <ImportProgressStep productImportId={state.productImportId} />}
    </>
  )
}
