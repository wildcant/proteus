import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CreateProductOptionForm } from '#/features/product-options/components/create-product-option-form'

export const Route = createFileRoute('/_authed/_shell/product-options/create')({
  component: CreateProductOptionRoute,
})

function CreateProductOptionRoute() {
  return (
    <RouteFocusModal>
      <CreateProductOptionForm />
    </RouteFocusModal>
  )
}
