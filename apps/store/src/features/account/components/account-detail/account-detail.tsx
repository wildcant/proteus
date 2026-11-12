import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import { LogOutIcon } from 'lucide-react'
import { Panel } from '#/components/store/panel/panel'
import { Button } from '#/components/ui/button/button'
import { useLogout } from '#/entities/customer/api/auth'
import { useSuspenseMe } from '#/entities/customer/api/customer'
import {
  accountDetail,
  accountDetailAddressBook,
  accountDetailDetails,
  accountDetailEyebrow,
  accountDetailFooter,
  accountDetailHeading,
  accountDetailOrders,
  accountDetailPanels,
  accountDetailPassword,
  accountDetailPaymentMethods,
  accountDetailSide,
  accountDetailSignOut,
  accountDetailTitle,
} from '#/features/account/components/account-detail/account-detail.variants'
import { DetailsPanel } from '#/features/account/components/details-panel/details-panel'
import { OrdersPanel } from '#/features/account/components/orders-panel/orders-panel'
import { PasswordPanel } from '#/features/account/components/password-panel/password-panel'
import type { AccountLinks } from '#/features/account/types/links'

export function AccountDetail({ links }: { links: AccountLinks }) {
  const { customer } = useSuspenseMe()
  const logout = useLogout(links)
  const { t } = useLingui()
  const { firstName } = customer

  return (
    <main className={cn(accountDetail(), 'mx-auto w-full')}>
      <div className={accountDetailHeading()}>
        <p className={accountDetailEyebrow()}>
          <Trans>Account</Trans>
        </p>
        <h1 className={accountDetailTitle()}>{firstName ? t`Hello, ${firstName}` : t`Hello`}</h1>
      </div>

      {/* One column on a phone, stacked in reading order: Orders, Details, Password. Grid rows
          stretch, so above lg the Orders block matches the height of the stack beside it without a
          hand-picked min-height that goes wrong the moment a panel is added. */}
      <div className={accountDetailPanels()}>
        <OrdersPanel links={links} className={accountDetailOrders()} />
        <div className={accountDetailSide()}>
          <Panel
            title={t`Address Book`}
            chevron
            render={<Link {...links.addressBook} />}
            className={accountDetailAddressBook()}
          />
          <Panel
            title={t`Payment Methods`}
            chevron
            render={<Link {...links.paymentMethods} />}
            className={accountDetailPaymentMethods()}
          />
          <DetailsPanel
            firstName={customer.firstName}
            lastName={customer.lastName}
            email={customer.email}
            className={accountDetailDetails()}
          />
          <PasswordPanel email={customer.email} className={accountDetailPassword()} />
        </div>
      </div>

      {/* Every panel above navigates or sends; the one action that ends the session sits below
          the rule instead of competing with them. Identical at every width. */}
      {/* `block` / `inline-flex`: the button sits on a text line, as the store renders it — the
          line's strut leaves 1.5px under it that the drawn flex column drops. The log-out glyph is
          not drawn yet (Button has no icon slot at this size). */}
      <div className={cn(accountDetailFooter(), 'block')}>
        <Button variant="link" onClick={logout} className={cn(accountDetailSignOut(), 'inline-flex')}>
          <LogOutIcon />
          <Trans>Sign out</Trans>
        </Button>
      </div>
    </main>
  )
}
