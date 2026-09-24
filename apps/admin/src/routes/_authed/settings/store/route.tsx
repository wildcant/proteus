import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Badge, Card, CardAction, CardDescription, CardHeader, CardTitle } from '@proteus/ui'
import { getCurrencyName } from '@proteus/utils'
import { createFileRoute } from '@tanstack/react-router'
import { PencilIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { regionsListQueryOptions, useSuspenseRegions } from '#/features/regions/api/regions'
import { storeQueryOptions, useSuspenseStore } from '#/features/store/api/store'
import { StoreCurrenciesCard } from '#/features/store/components/store-currencies-card'
import { defaultCurrency } from '#/features/store/utils/store-currencies'
import { activeLocale } from '#/lib/i18n/locale'

export const Route = createFileRoute('/_authed/settings/store')({
  staticData: { breadcrumb: msg`Store` },
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
  const { t } = useLingui()
  const { data } = useSuspenseStore()
  const { store } = data
  const { data: regions } = useSuspenseRegions()

  const currency = defaultCurrency(store.currencies)
  const region = regions.regions.find((candidate) => candidate.id === store.defaultRegionId)

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>
            <Trans>Store</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>Manage your store's details</Trans>
          </CardDescription>
          <CardAction className="flex items-center gap-x-3">
            {/* Absolute, like the Currencies card's Add: there is one store, so these paths are
                fixed, and a relative link would resolve against whichever child is open. */}
            <ActionMenu
              groups={[{ actions: [{ label: t`Edit`, to: '/settings/store/edit', icon: <PencilIcon /> }] }]}
            />
          </CardAction>
        </CardHeader>
        <SectionRow title={t`Name`} value={store.name} />
        {/* Both defaults carry a description because they sit adjacent and read as one setting:
            a merchant seeing a default currency the default region does not settle in would
            otherwise conclude the store quotes it. Only the region decides that. */}
        <SectionRow
          title={t`Default currency`}
          description={t`Leads the currency columns when you price a product. It is not what shoppers are quoted.`}
          value={
            currency ? (
              <span className="flex items-center gap-x-2">
                <Badge>{currency.currencyCode.toUpperCase()}</Badge>
                {getCurrencyName(currency.currencyCode, activeLocale())}
              </span>
            ) : null
          }
        />
        {/* `-` is what `SectionRow` renders for an absent value, and an unset default region is a
            state the store can legitimately be in — every shopper picks their own market. */}
        <SectionRow
          title={t`Default region`}
          description={t`The market — and so the currency — a shopper is priced in before they pick one.`}
          value={region?.name ?? null}
        />
        {/* Stringified so an empty threshold takes `SectionRow`'s `-`, the same way an unset
            default region does: a store without one is not a store with none left. */}
        <SectionRow
          title={t`Low stock threshold`}
          description={t`At or below this many units available, a variant counts as running low. Leave it empty and nothing is ever low.`}
          value={store.lowStockThreshold?.toString() ?? null}
        />
      </Card>
      <StoreCurrenciesCard />
    </PageLayout.SingleColumn>
  )
}
