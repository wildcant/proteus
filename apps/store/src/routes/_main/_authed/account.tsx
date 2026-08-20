import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/button'
import { useLogout } from '#/features/auth/api/auth'

export const Route = createFileRoute('/_main/_authed/account')({
  component: AccountPage,
})

function AccountPage() {
  const { customer } = Route.useRouteContext()
  const logout = useLogout()

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-medium text-2xl text-foreground">Hello, {customer.firstName}</h1>
        <span className="text-(--foreground-muted) text-sm">
          Signed in as <span className="font-semibold">{customer.email}</span>
        </span>
      </div>

      <div className="border-border border-t pt-8">
        <div className="mb-8 flex flex-col gap-y-2">
          <h3 className="font-semibold text-foreground text-lg">Profile</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-(--foreground-muted)">Name</dt>
            <dd>
              {customer.firstName} {customer.lastName}
            </dd>
            <dt className="text-(--foreground-muted)">Email</dt>
            <dd>{customer.email}</dd>
          </dl>
        </div>

        <div className="flex gap-3">
          <Button render={<Link to="/products" />}>Browse products</Button>
          <Button variant="outline" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  )
}
