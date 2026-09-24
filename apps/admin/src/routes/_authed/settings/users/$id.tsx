import { msg } from '@lingui/core/macro'
import { Card, CardHeader, CardTitle, RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { rolesListQueryOptions, userRolesQueryOptions } from '#/features/users/api/user-roles'
import { userQueryOptions, useSuspenseUser } from '#/features/users/api/users'
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
  staticData: { breadcrumb: msg`User` },
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: UserDetailRoute,
})

function UserDetailRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseUser(id)
  const { user } = data

  return (
    <RouteFocusModal>
      <RouteFocusModal.Header />
      <RouteFocusModal.Body>
        <div className="mx-auto w-full max-w-180 px-6 py-16">
          <Card className="gap-0 divide-y py-0">
            <CardHeader>
              <CardTitle>{user.name}</CardTitle>
            </CardHeader>
            <SectionRow title="Email" value={user.email} />
          </Card>
          <Suspense fallback={<SingleColumnPageSkeleton sections={1} />}>
            <UserRoleAssignment userId={id} />
          </Suspense>
        </div>
      </RouteFocusModal.Body>
    </RouteFocusModal>
  )
}
