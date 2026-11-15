import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import type { AdminPayment } from '#/api/generated/model'
import { useRefundPaymentForm } from '#/features/orders/hooks/use-refund-payment-form'
import { refundableAmount } from '#/features/orders/utils/payment-amounts'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { activeLocale } from '#/lib/i18n/locale'

export function RefundPaymentForm({ orderId, payment }: { orderId: string; payment: AdminPayment }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { form } = useRefundPaymentForm(orderId, payment, { onSuccess: () => handleSuccess() })
  const refundable = formatPrice(refundableAmount(payment), payment.currencyCode, activeLocale())

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Refund payment</Trans>
            </RouteDrawer.Title>
            <RouteDrawer.Description>
              <Trans>Record money returned to the customer from this payment.</Trans>
            </RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="amount">
              {(field) => (
                <field.TextField
                  label={t`Amount (${payment.currencyCode.toUpperCase()})`}
                  description={t`Refundable: ${refundable}`}
                  inputMode="decimal"
                  autoFocus
                />
              )}
            </form.AppField>
            <form.AppField name="note">{(field) => <field.TextareaField label={t`Note`} rows={3} />}</form.AppField>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Refund</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
