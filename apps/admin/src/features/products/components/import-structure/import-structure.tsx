import { Trans } from '@lingui/react/macro'
import { RouteFocusModal } from '@proteus/ui'
import { useState } from 'react'
import type { AdminCatalogStructureError } from '#/api/generated/model'
import { StructurePreviewStep } from '#/features/products/components/import-structure/structure-preview-step'
import { StructureUploadStep } from '#/features/products/components/import-structure/structure-upload-step'
import type { PreviewedCatalogStructure } from '#/features/products/hooks/use-upload-catalog-structure-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

/** A refused file stays on upload; only a clean preview can be applied. */
type StructureStep =
  | { step: 'upload'; errors: AdminCatalogStructureError[] }
  | ({ step: 'preview' } & PreviewedCatalogStructure)

function afterRead(previewed: PreviewedCatalogStructure): StructureStep {
  if (previewed.plan.errors.length > 0) return { step: 'upload', errors: previewed.plan.errors }
  return { step: 'preview', ...previewed }
}

export function ImportStructure() {
  const { closeLabel } = useUiCopy()
  const [state, setState] = useState<StructureStep>({ step: 'upload', errors: [] })

  return (
    <>
      <RouteFocusModal.Header closeLabel={closeLabel}>
        <RouteFocusModal.Title className="sr-only">
          <Trans>Import structure</Trans>
        </RouteFocusModal.Title>
      </RouteFocusModal.Header>
      {state.step === 'upload' && (
        <StructureUploadStep errors={state.errors} onRead={(read) => setState(afterRead(read))} />
      )}
      {state.step === 'preview' && <StructurePreviewStep fileId={state.fileId} plan={state.plan} />}
    </>
  )
}
