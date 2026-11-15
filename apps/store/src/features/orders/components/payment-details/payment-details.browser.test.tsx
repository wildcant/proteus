import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreOrderDetail } from '#/api/generated/model'
import { PaymentDetails } from '#/features/orders/components/payment-details/payment-details'
import { I18nTestProvider } from '#/lib/i18n/test-i18n'
import { DEFAULT_MARKET, type MarketContext } from '#/lib/market'

function order(overrides: Partial<StoreOrderDetail>): StoreOrderDetail {
  return {
    id: 'order_1',
    displayId: 1042,
    reference: '1042',
    status: 'pending',
    paymentStatus: 'not_paid',
    fulfillmentStatus: 'unfulfilled',
    currencyCode: 'usd',
    createdAt: '2026-01-01T00:00:00.000Z',
    canceledAt: null,
    lineItems: [],
    shippingAddress: null,
    shippingMethods: [],
    totals: { itemsTotal: '90', shippingTotal: '10', orderTotal: '100', paidTotal: '0', outstandingTotal: '100' },
    ...overrides,
  }
}

/** The market the amounts are formatted in comes from the router's context. */
function renderPanel(value: StoreOrderDetail) {
  const market: MarketContext = {
    current: DEFAULT_MARKET,
    markets: [DEFAULT_MARKET],
    defaultMarket: DEFAULT_MARKET,
    resolvedFromUrl: true,
  }
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <PaymentDetails order={value} /> }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { queryClient: new QueryClient(), market },
  })

  // The app's own router type is registered globally; this stub is deliberately not it.
  return render(<RouterProvider router={router as never} />, { wrapper: I18nTestProvider })
}

test('a deposit shows what was paid and what is still due, and a canceled order owes nothing', async () => {
  const deposit = await renderPanel(
    order({
      paymentStatus: 'partially_captured',
      totals: { itemsTotal: '90', shippingTotal: '10', orderTotal: '100', paidTotal: '30', outstandingTotal: '70' },
    }),
  )

  await expect.element(page.getByText('Partly paid')).toBeVisible()
  await expect.element(page.getByText('$30.00 paid')).toBeVisible()
  await expect.element(page.getByText('$70.00 due')).toBeVisible()
  await deposit.unmount()

  // Canceled with part of the deposit refunded: what the shop kept, and no amount due.
  renderPanel(
    order({
      status: 'canceled',
      paymentStatus: 'partially_refunded',
      totals: { itemsTotal: '90', shippingTotal: '10', orderTotal: '100', paidTotal: '20', outstandingTotal: '80' },
    }),
  )

  await expect.element(page.getByText('Partly refunded')).toBeVisible()
  await expect.element(page.getByText('$20.00 paid')).toBeVisible()
  await expect.element(page.getByText(/due/)).not.toBeInTheDocument()
})
