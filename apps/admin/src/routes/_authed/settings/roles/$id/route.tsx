import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { roleQueryOptions } from '#/features/access-control/api/roles'
import { permissionsListQueryOptions } from '#/features/access-control/api/permissions'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { EditRoleForm } from '#/features/access-control/components/edit-role-form'

export const Route = createFileRoute('/_authed/settings/roles/$id')({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(roleQueryOptions(params.id))
    return { breadcrumb: data.role.name }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(permissionsListQueryOptions()),
  pendingComponent: () => <SingleColumnPageSkeleton sections={1} />,
  component: RoleEditPage,
})

function RoleEditPage() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(roleQueryOptions(id))

  return <EditRoleForm role={data.role} />
}
