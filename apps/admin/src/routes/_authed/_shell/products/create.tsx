import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { ensureOrganizationOptions } from '#/features/products/api/organization-options'
import { CreateProductForm } from '#/features/products/components/create-product-form/create-product-form'

export const Route = createFileRoute('/_authed/_shell/products/create')({
  loader: ({ context }) => ensureOrganizationOptions(context.queryClient),
  component: CreateProductRoute,
})

function CreateProductRoute() {
  return (
    <RouteFocusModal>
      <CreateProductForm />
    </RouteFocusModal>
  )
}
