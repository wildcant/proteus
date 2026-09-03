import { createFileRoute } from '@tanstack/react-router'
import { CheckoutReturn } from '#/features/checkout/payment/checkout-return'

/**
 * `/checkout-return`, deliberately a sibling of `/checkout` rather than a child of it.
 *
 * The checkout route is a layout that renders the whole payment page around its `Outlet`, which a
 * shopper coming back from their bank should not see rebuilt behind a "completing your order"
 * panel. This sits under the same header-only checkout shell instead.
 */
export const Route = createFileRoute('/_checkout/checkout-return')({
  component: CheckoutReturnPage,
  // Every parameter here is the gateway's, not ours: Stripe appends `payment_intent`,
  // `payment_intent_client_secret` and `redirect_status`, and another provider will append
  // something else. Kept as strings and handed to the adapter whole rather than modelled.
  validateSearch: (search: Record<string, unknown>): Record<string, string> =>
    Object.fromEntries(Object.entries(search).map(([key, value]) => [key, String(value)])),
})

function CheckoutReturnPage() {
  const search = Route.useSearch()
  return <CheckoutReturn query={new URLSearchParams(search)} />
}
