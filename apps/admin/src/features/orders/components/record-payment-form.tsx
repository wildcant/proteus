import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { useRecordPaymentForm } from '#/features/orders/hooks/use-record-payment-form'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { activeLocale } from '#/lib/i18n/locale'

export function RecordPaymentForm({ order }: { order: AdminOrderResponseOrder }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { form } = useRecordPaymentForm(order, { onSuccess: () => handleSuccess() })
  const outstanding = formatPrice(order.totals.outstandingTotal, order.currencyCode, activeLocale())

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Record payment</Trans>
            </RouteDrawer.Title>
            <RouteDrawer.Description>
              <Trans>A payment received outside the store, such as a bank transfer or cash on delivery.</Trans>
            </RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="amount">
              {(field) => (
                <field.TextField
                  label={t`Amount (${order.currencyCode.toUpperCase()})`}
                  description={t`Outstanding: ${outstanding}`}
                  inputMode="decimal"
                  autoFocus
                />
              )}
            </form.AppField>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Record payment</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
