import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { useCancelOrderForm } from '#/features/orders/hooks/use-cancel-order-form'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { activeLocale } from '#/lib/i18n/locale'

/** Canceling an Order that has received money: the refund and the cancel are one action. */
export function CancelOrderForm({ order }: { order: AdminOrderResponseOrder }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { form } = useCancelOrderForm(order, { onSuccess: () => handleSuccess() })
  const received = formatPrice(order.totals.paidTotal, order.currencyCode, activeLocale())

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Cancel order</Trans>
            </RouteDrawer.Title>
            <RouteDrawer.Description>
              <Trans>
                This order has received {received}. Choose how much of it to refund, from nothing to all of it. Its
                inventory reservations are released.
              </Trans>
            </RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="refundAmount">
              {(field) => (
                <field.TextField
                  label={t`Refund amount (${order.currencyCode.toUpperCase()})`}
                  description={t`Received: ${received}`}
                  inputMode="decimal"
                  autoFocus
                />
              )}
            </form.AppField>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Keep order</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Cancel order</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
