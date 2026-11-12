import { createFileRoute } from '@tanstack/react-router'
import { RouteDrawer } from '#/components/ui/route-drawer/route-drawer'
import { CreateAddressForm } from '#/features/address/components/create-address-form'
import { flowLinks } from '#/navigation/links'

export const Route = createFileRoute('/_checkout/checkout/addresses/new')({
  component: () => (
    <RouteDrawer prev={flowLinks('CheckoutContent').CLOSE().to}>
      <CreateAddressForm />
    </RouteDrawer>
  ),
})
