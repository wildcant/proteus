import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { ImportStructure } from '#/features/products/components/import-structure/import-structure'

export const Route = createFileRoute('/_authed/_shell/products/import-structure')({
  component: ImportStructureRoute,
})

function ImportStructureRoute() {
  return (
    <RouteFocusModal>
      <ImportStructure />
    </RouteFocusModal>
  )
}
