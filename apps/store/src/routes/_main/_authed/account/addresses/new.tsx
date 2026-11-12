import { createFileRoute } from '@tanstack/react-router'
import { RouteDrawer } from '#/components/ui/route-drawer/route-drawer'
import { CreateAddressForm } from '#/features/address/components/create-address-form'

export const Route = createFileRoute('/_main/_authed/account/addresses/new')({
  component: () => (
    <RouteDrawer>
      <CreateAddressForm />
    </RouteDrawer>
  ),
})
