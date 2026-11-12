import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CreateProductTypeForm } from '#/features/product-types/components/create-product-type-form'

export const Route = createFileRoute('/_authed/_shell/product-types/create')({
  component: CreateProductTypeRoute,
})

function CreateProductTypeRoute() {
  return (
    <RouteFocusModal>
      <CreateProductTypeForm />
    </RouteFocusModal>
  )
}
