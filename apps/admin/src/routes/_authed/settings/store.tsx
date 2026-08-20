import { createFileRoute } from '@tanstack/react-router'
import { PageLayout } from '#/components/layout/page-layout'

export const Route = createFileRoute('/_authed/settings/store')({
  staticData: { breadcrumb: 'Store' },
  component: StorePage,
})

function StorePage() {
  return (
    <PageLayout.SingleColumn>
      <div className="rounded-lg border p-6">
        <h2 className="font-semibold text-lg">Store Details</h2>
        <p className="mt-1 text-muted-foreground text-sm">Manage your store settings.</p>
      </div>
    </PageLayout.SingleColumn>
  )
}
