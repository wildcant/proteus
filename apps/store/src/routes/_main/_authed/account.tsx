import { createFileRoute, Link } from '@tanstack/react-router'
import { useLogout } from '#/features/auth/api/auth'

export const Route = createFileRoute('/_main/_authed/account')({
  component: AccountPage,
})

function AccountPage() {
  const { customer } = Route.useRouteContext()
  const logout = useLogout()

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="island-kicker mb-3">Account</p>
            <h1 className="display-title text-4xl font-bold tracking-tight text-[var(--sea-ink)]">
              Hello, {customer.firstName}
            </h1>
          </div>
          <span className="text-sm text-[var(--sea-ink-soft)]">
            Signed in as <span className="font-semibold">{customer.email}</span>
          </span>
        </div>

        <div className="border-t border-[var(--line)] pt-8">
          <div className="flex items-start gap-x-16 mb-8">
            <div className="flex flex-col gap-y-2">
              <h3 className="text-lg font-semibold text-[var(--sea-ink)]">Profile</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-[var(--sea-ink-soft)]">Name</dt>
                <dd>
                  {customer.firstName} {customer.lastName}
                </dd>
                <dt className="text-[var(--sea-ink-soft)]">Email</dt>
                <dd>{customer.email}</dd>
              </dl>
            </div>
          </div>

          <div className="flex gap-3">
            <Link to="/products" className="demo-button">
              Browse products
            </Link>
            <button type="button" onClick={logout} className="demo-button-secondary demo-button">
              Sign out
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
