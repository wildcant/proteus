import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useAppForm } from '#/lib/form-hook'
import { SpanishI18nTestProvider } from '#/lib/i18n/test-i18n'
import type { Market } from '#/lib/market'

const colombia: Market = { localeCode: 'es-CO', iso2: 'co', displayName: 'Colombia', currencyCode: 'cop' }

function AddressCountry() {
  const form = useAppForm({ defaultValues: { countryCode: '' } })
  return <form.AppField name="countryCode">{(field) => <field.CountryField />}</form.AppField>
}

test('labels the country in the page language', async () => {
  const router = createRouter({
    routeTree: createRootRoute({ component: AddressCountry }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { market: { current: colombia, markets: [colombia], defaultMarket: colombia, resolvedFromUrl: true } },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  // The app's own router type is registered globally; this stub is deliberately not it.
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
    { wrapper: SpanishI18nTestProvider },
  )

  await expect.element(page.getByLabelText('País')).toHaveValue('Colombia')
})
