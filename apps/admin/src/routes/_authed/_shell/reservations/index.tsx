import { useLingui } from '@lingui/react/macro'
import { AdminReservationListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { reservationsListQueryOptions } from '#/features/inventory/api/inventory'
import { useReservationTable } from '#/features/inventory/hooks/use-reservation-table'

export const Route = createFileRoute('/_authed/_shell/reservations/')({
  validateSearch: AdminReservationListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(reservationsListQueryOptions()),
  component: ReservationsPage,
})

function ReservationsPage() {
  const { t } = useLingui()
  const reservations = useReservationTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={reservations} className="flex-1" heading={t`Reservations`} />
    </PageLayout.SingleColumn>
  )
}
