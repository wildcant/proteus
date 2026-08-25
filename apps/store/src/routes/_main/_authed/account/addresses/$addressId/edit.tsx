import { createFileRoute, Navigate } from '@tanstack/react-router'
import { StoreDrawer } from '#/components/store-drawer'
import { addressesQueryOptions, useSuspenseAddresses } from '#/features/address/api/addresses'
import { UpdateAddressForm } from '#/features/address/components/update-address-form'

export const Route = createFileRoute('/_main/_authed/account/addresses/$addressId/edit')({
  // Awaited, unlike the list page's prefetch: a deep link straight into the drawer has no
  // cached list to read the address out of, and the form has nothing to render without it.
  loader: ({ context }) => context.queryClient.ensureQueryData(addressesQueryOptions()),
  component: EditAddressRoute,
})

function EditAddressRoute() {
  const { addressId } = Route.useParams()
  const { addresses } = useSuspenseAddresses()
  const address = addresses.find((candidate) => candidate.id === addressId)

  // The list is the only source of an address, so a stale link — a bookmark to one deleted
  // since — has nothing to edit. Send them back to the book rather than show an empty create
  // form wearing an edit title.
  if (!address) return <Navigate to="/account/addresses" replace />

  return (
    <StoreDrawer prev="/account/addresses">
      <UpdateAddressForm address={address} />
    </StoreDrawer>
  )
}
