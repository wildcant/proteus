import { createFileRoute, Navigate } from '@tanstack/react-router'
import { RouteDrawer } from '#/components/ui/route-drawer/route-drawer'
import { useSuspenseAddresses } from '#/entities/address/api/addresses'
import { UpdateAddressForm } from '#/features/address/components/update-address-form'

export const Route = createFileRoute('/_checkout/checkout/addresses/$addressId/edit')({
  component: EditAddressRoute,
})

function EditAddressRoute() {
  const { addressId } = Route.useParams()
  const { addresses } = useSuspenseAddresses()
  const address = addresses.find((candidate) => candidate.id === addressId)

  // Same reason the account's copy does it: the list is the only source of an address, so a link
  // to one deleted since has nothing to edit.
  if (!address) return <Navigate to="/checkout" replace />

  return (
    <RouteDrawer prev="/checkout">
      <UpdateAddressForm address={address} />
    </RouteDrawer>
  )
}
