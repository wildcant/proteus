import { Badge, Card, CardAction, CardHeader, CardTitle, getCurrencyName } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { PencilIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { regionQueryOptions } from '#/features/regions/api/regions'
import { paymentProviderLabel } from '#/features/regions/utils/payment-provider-label'

export const Route = createFileRoute('/_authed/settings/regions/$id/_detail')({
  pendingComponent: () => <SingleColumnPageSkeleton sections={1} />,
  component: RegionDetailLayout,
})

function RegionDetailLayout() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(regionQueryOptions(id))
  const { region } = data

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>{region.name}</CardTitle>
          <CardAction className="flex items-center gap-x-3">
            {/* Edit only. A region owns live carts, orders and prices, so there is no Delete. */}
            <ActionMenu groups={[{ actions: [{ label: 'Edit', to: './edit', icon: <PencilIcon /> }] }]} />
          </CardAction>
        </CardHeader>
        <SectionRow
          title="Currency"
          value={
            <span className="flex items-center gap-x-2">
              <Badge>{region.currencyCode.toUpperCase()}</Badge>
              {getCurrencyName(region.currencyCode)}
            </span>
          }
        />
        <SectionRow
          title="Payment Providers"
          value={
            region.paymentProviders.length > 0
              ? region.paymentProviders.map((provider) => (
                  <Badge key={provider.id}>{paymentProviderLabel(provider.id)}</Badge>
                ))
              : null
          }
        />
      </Card>
    </PageLayout.SingleColumn>
  )
}
