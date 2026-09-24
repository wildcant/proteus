import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { LogOutIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { Panel } from '#/components/panel'
import { useSuspenseMe } from '#/features/account/api/customer'
import { DetailsPanel } from '#/features/account/components/details-panel'
import { OrdersPanel } from '#/features/account/components/orders-panel'
import { PasswordPanel } from '#/features/account/components/password-panel'
import { useLogout } from '#/features/auth/api/auth'

export function AccountDetail() {
  const { customer } = useSuspenseMe()
  const logout = useLogout()
  const { t } = useLingui()
  const { firstName } = customer

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <p className="text-ink-muted text-sm">
        <Trans>Account</Trans>
      </p>
      <h1 className="type-display mt-2 text-ink">{firstName ? t`Hello, ${firstName}` : t`Hello`}</h1>

      {/* One column on a phone, stacked in reading order: Orders, Details, Password. Grid rows
          stretch, so above lg the Orders block matches the height of the stack beside it without a
          hand-picked min-height that goes wrong the moment a panel is added. */}
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <OrdersPanel className="lg:col-span-2" />
        <div className="flex flex-col gap-4">
          <Panel title={t`Address Book`} chevron render={<Link to="/account/addresses" />} />
          <Panel title={t`Payment Methods`} chevron render={<Link to="/account/payment-methods" />} />
          <DetailsPanel firstName={customer.firstName} lastName={customer.lastName} email={customer.email} />
          <PasswordPanel email={customer.email} />
        </div>
      </div>

      {/* Every panel above navigates or sends; the one action that ends the session sits below
          the rule instead of competing with them. Identical at every width. */}
      <div className="mt-10 border-line border-t pt-6">
        <Button variant="link" onClick={logout}>
          <LogOutIcon />
          <Trans>Sign out</Trans>
        </Button>
      </div>
    </main>
  )
}
