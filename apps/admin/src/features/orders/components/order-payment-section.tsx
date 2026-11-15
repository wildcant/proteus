import { Trans, useLingui } from '@lingui/react/macro'
import { ButtonLink, Card, CardAction, CardHeader, CardTitle, StatusBadge } from '@proteus/ui'
import { formatDatetime, formatPrice } from '@proteus/utils'
import BigNumber from 'bignumber.js'
import { BanknoteIcon, Undo2Icon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AdminOrderResponseOrder, AdminPayment } from '#/api/generated/model'
import { paymentStatusColors, paymentStatusLabels } from '#/features/orders/utils/order-status'
import { refundableAmount } from '#/features/orders/utils/payment-amounts'
import { activeLocale, dateLocale } from '#/lib/i18n/locale'

export function OrderPaymentSection({ order }: { order: AdminOrderResponseOrder }) {
  const { i18n } = useLingui()
  const payments = order.paymentCollections.flatMap((collection) => collection.payments ?? [])
  const canRecordPayment =
    order.status !== 'canceled' &&
    order.status !== 'draft' &&
    new BigNumber(order.totals.outstandingTotal).isGreaterThan(0)

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Payments</Trans>
        </CardTitle>
        <CardAction className="flex items-center gap-x-3">
          <StatusBadge color={paymentStatusColors[order.paymentStatus]}>
            {i18n._(paymentStatusLabels[order.paymentStatus])}
          </StatusBadge>
          {canRecordPayment ? (
            <ButtonLink size="sm" variant="secondary" to="/orders/$id/record-payment" params={{ id: order.id }}>
              <BanknoteIcon className="size-4" />
              <Trans>Record payment</Trans>
            </ButtonLink>
          ) : null}
        </CardAction>
      </CardHeader>

      {payments.length === 0 ? (
        <p className="px-6 py-4 text-muted-foreground text-sm">
          <Trans>No payments recorded yet.</Trans>
        </p>
      ) : (
        payments.map((payment) => <PaymentRow key={payment.id} orderId={order.id} payment={payment} />)
      )}
    </Card>
  )
}

function PaymentRow({ orderId, payment }: { orderId: string; payment: AdminPayment }) {
  const money = (amount: string) => formatPrice(amount, payment.currencyCode, activeLocale())
  const canRefund = new BigNumber(refundableAmount(payment)).isGreaterThan(0)
  // One chronological list, so a deposit, its refund and the rest read in the order they happened.
  const ledger = [
    ...(payment.captures ?? []).map((row) => ({ ...row, kind: 'capture' as const, note: null })),
    ...(payment.refunds ?? []).map((row) => ({ ...row, kind: 'refund' as const })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <div className="flex flex-col gap-3 px-6 py-4 text-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="font-medium">
            <Trans>Payment of {money(payment.amount)}</Trans>
          </span>
          <span className="text-muted-foreground text-xs">
            {payment.providerId} · {formatDatetime(payment.createdAt, dateLocale())}
          </span>
        </div>
        {canRefund ? (
          <ButtonLink
            size="sm"
            variant="outline"
            to="/orders/$id/payments/$paymentId/refund"
            params={{ id: orderId, paymentId: payment.id }}
          >
            <Undo2Icon className="size-4" />
            <Trans>Refund</Trans>
          </ButtonLink>
        ) : null}
      </div>

      <ul className="flex flex-col gap-1">
        {ledger.map((entry) => (
          <LedgerRow
            key={entry.id}
            label={entry.kind === 'capture' ? <Trans>Received</Trans> : <Trans>Refunded</Trans>}
            date={entry.createdAt}
            amount={entry.kind === 'capture' ? money(entry.amount) : `−${money(entry.amount)}`}
            note={entry.note}
          />
        ))}
      </ul>
    </div>
  )
}

function LedgerRow({
  label,
  date,
  amount,
  note,
}: {
  label: ReactNode
  date: string
  amount: string
  note?: string | null
}) {
  return (
    <li className="flex items-start justify-between gap-4">
      <div className="flex flex-col">
        <span>
          {label} <span className="text-muted-foreground text-xs">{formatDatetime(date, dateLocale())}</span>
        </span>
        {!!note && <span className="text-muted-foreground text-xs">{note}</span>}
      </div>
      <span className="shrink-0 tabular-nums">{amount}</span>
    </li>
  )
}
