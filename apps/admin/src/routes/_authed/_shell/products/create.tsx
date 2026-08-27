import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CreateProductForm } from '#/features/products/components/create-product-form/create-product-form'

export const Route = createFileRoute('/_authed/_shell/products/create')({
  component: CreateProductRoute,
})

function CreateProductRoute() {
  return (
    <RouteFocusModal>
      <CreateProductForm />
    </RouteFocusModal>
  )
}
