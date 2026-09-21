import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { customerQueryOptions, useSuspenseCustomer } from '#/features/customers/api/customers'
import { UpdateCustomerForm } from '#/features/customers/components/update-customer-form'

export const Route = createFileRoute('/_authed/_shell/customers/$id/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(customerQueryOptions(params.id)),
  component: EditCustomerRoute,
})

function EditCustomerRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseCustomer(id)

  return (
    <RouteFocusModal>
      <UpdateCustomerForm customer={data.customer} />
    </RouteFocusModal>
  )
}
