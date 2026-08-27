import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { addressesQueryOptions } from '#/features/address/api/addresses'
import { isRegistered } from '#/lib/auth-token'

/**
 * The address book, reachable from checkout. Guests never see the link that leads here — they have
 * no saved addresses to pick from — but a deep link is still a URL someone can type, and these
 * endpoints are customer-scoped.
 */
export const Route = createFileRoute('/_checkout/checkout/addresses')({
  beforeLoad: () => {
    if (!isRegistered()) throw redirect({ to: '/checkout' })
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(addressesQueryOptions()),
  component: () => <Outlet />,
})
