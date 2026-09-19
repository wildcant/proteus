import { Card, CardHeader, CardTitle } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import { userQueryOptions } from '#/features/users/api/users'
import { rolesListQueryOptions, userRolesQueryOptions } from '#/features/users/api/user-roles'
import { UserRoleAssignment } from '#/features/users/components/user-role-assignment'

export const Route = createFileRoute('/_authed/settings/users/$id')({
  loader: async ({ context, params }) => {
    const [userData] = await Promise.all([
      context.queryClient.ensureQueryData(userQueryOptions(params.id)),
      context.queryClient.ensureQueryData(rolesListQueryOptions()),
      context.queryClient.ensureQueryData(userRolesQueryOptions(params.id)),
    ])
    return { breadcrumb: userData.user.name }
  },
  staticData: { breadcrumb: 'User' },
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: UserDetailPage,
})

function UserDetailPage() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(userQueryOptions(id))
  const { user } = data

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
        </CardHeader>
        <SectionRow title="Email" value={user.email} />
      </Card>
      <Suspense fallback={<SingleColumnPageSkeleton sections={1} />}>
        <UserRoleAssignment userId={id} />
      </Suspense>
    </PageLayout.SingleColumn>
  )
}
