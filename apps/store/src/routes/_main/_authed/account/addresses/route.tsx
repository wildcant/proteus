import { createFileRoute, Outlet } from '@tanstack/react-router'
import { addressesQueryOptions } from '#/features/address/api/addresses'
import { AddressBook } from '#/features/address/components/address-book'

export const Route = createFileRoute('/_main/_authed/account/addresses')({
  // Fire-and-forget, so the page header paints while the list is still in flight.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(addressesQueryOptions())
  },
  component: AddressBookRoute,
})

/**
 * The page is the layout, so the list stays mounted behind the add and edit drawers and the
 * shopper's scroll position survives them.
 */
function AddressBookRoute() {
  return (
    <>
      <AddressBook />
      <Outlet />
    </>
  )
}
