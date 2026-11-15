import { createFileRoute } from '@tanstack/react-router'
import { TwoColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { DraftCustomerSection } from '#/features/draft-orders/components/draft-customer-section'
import { DraftGeneralSection } from '#/features/draft-orders/components/draft-general-section'
import { DraftShippingSection } from '#/features/draft-orders/components/draft-shipping-section'
import { DraftSummarySection } from '#/features/draft-orders/components/draft-summary-section'
import { useDraftOrderData } from '#/features/draft-orders/hooks/use-draft-order-data'

export const Route = createFileRoute('/_authed/_shell/draft-orders/$id/_detail')({
  pendingComponent: () => <TwoColumnPageSkeleton mainSections={3} sidebarSections={1} />,
  component: DraftOrderDetailLayout,
})

function DraftOrderDetailLayout() {
  const { id } = Route.useParams()
  const data = useDraftOrderData(id)

  return (
    <PageLayout.TwoColumn>
      <PageLayout.TwoColumn.Main>
        <DraftGeneralSection {...data} />
        <DraftSummarySection {...data} />
        <DraftShippingSection {...data} />
      </PageLayout.TwoColumn.Main>
      <PageLayout.TwoColumn.Side>
        <DraftCustomerSection {...data} />
      </PageLayout.TwoColumn.Side>
    </PageLayout.TwoColumn>
  )
}
