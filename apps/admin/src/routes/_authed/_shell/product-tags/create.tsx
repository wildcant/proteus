import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CreateProductTagForm } from '#/features/product-tags/components/create-product-tag-form'

export const Route = createFileRoute('/_authed/_shell/product-tags/create')({
  component: CreateProductTagRoute,
})

function CreateProductTagRoute() {
  return (
    <RouteFocusModal>
      <CreateProductTagForm />
    </RouteFocusModal>
  )
}
