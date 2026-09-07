import { Badge, Card, CardAction, CardDescription, CardHeader, CardTitle, getCurrencyName } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { PencilIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { regionsListQueryOptions } from '#/features/regions/api/regions'
import { storeQueryOptions } from '#/features/store/api/store'
import { StoreCurrenciesCard } from '#/features/store/components/store-currencies-card'
import { defaultCurrency } from '#/features/store/utils/store-currencies'

export const Route = createFileRoute('/_authed/settings/store')({
  staticData: { breadcrumb: 'Store' },
  // The regions come along because the Default region row shows a name, not an id — and the
  // Edit drawer's selector reads the same cached list.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(storeQueryOptions()),
      context.queryClient.ensureQueryData(regionsListQueryOptions()),
    ]),
  pendingComponent: () => <SingleColumnPageSkeleton sections={1} />,
  component: StoreLayout,
})

/**
 * The store's details and the currencies it sells in.
 *
 * A layout route rather than a leaf, because `PageLayout.SingleColumn` renders an `Outlet` — the
 * Edit drawer and the Add-currencies modal are their own routes underneath, per ADR-0019, and they
 * open over these cards rather than replacing them.
 *
 * `Default sales channel` and `Default location` from the reference admin are absent: Proteus has
 * neither a sales-channel module nor a stock-location one, so there is nothing behind either row.
 */
function StoreLayout() {
  const { data } = useSuspenseQuery(storeQueryOptions())
  const { store } = data
  const { data: regions } = useSuspenseQuery(regionsListQueryOptions())

  const currency = defaultCurrency(store.currencies)
  const region = regions.regions.find((candidate) => candidate.id === store.defaultRegionId)

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>Store</CardTitle>
          <CardDescription>Manage your store's details</CardDescription>
          <CardAction className="flex items-center gap-x-3">
            {/* Absolute, like the Currencies card's Add: there is one store, so these paths are
                fixed, and a relative link would resolve against whichever child is open. */}
            <ActionMenu groups={[{ actions: [{ label: 'Edit', to: '/settings/store/edit', icon: <PencilIcon /> }] }]} />
          </CardAction>
        </CardHeader>
        <SectionRow title="Name" value={store.name} />
        <SectionRow
          title="Default currency"
          value={
            currency ? (
              <span className="flex items-center gap-x-2">
                <Badge>{currency.currencyCode.toUpperCase()}</Badge>
                {getCurrencyName(currency.currencyCode)}
              </span>
            ) : null
          }
        />
        {/* `-` is what `SectionRow` renders for an absent value, and an unset default region is a
            state the store can legitimately be in — every shopper picks their own market. */}
        <SectionRow title="Default region" value={region?.name ?? null} />
      </Card>
      <StoreCurrenciesCard />
    </PageLayout.SingleColumn>
  )
}
