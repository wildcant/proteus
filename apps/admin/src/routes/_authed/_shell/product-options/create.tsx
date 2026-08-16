import { createFileRoute } from '@tanstack/react-router'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
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
