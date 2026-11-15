import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import { CircleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import type { AdminDraftOrderResponseDraftOrder } from '#/api/generated/model'
import { useConvertDraftForm } from '#/features/draft-orders/hooks/use-convert-draft-form'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { activeLocale } from '#/lib/i18n/locale'

export function ConvertDraftForm({ draftOrder }: { draftOrder: AdminDraftOrderResponseDraftOrder }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  // A refusal (a pair sold out since the draft was made) stays on screen beside the action it
  // refused, so the admin can tell the shopper which pair before closing the drawer.
  const [refusal, setRefusal] = useState<string | null>(null)
  const { form } = useConvertDraftForm(draftOrder, {
    onSuccess: ({ order }) => handleSuccess(`/orders/${order.id}`),
    onError: setRefusal,
  })
  const total = formatPrice(draftOrder.totals.orderTotal, draftOrder.currencyCode, activeLocale())

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Convert to order</Trans>
            </RouteDrawer.Title>
            <RouteDrawer.Description>
              <Trans>
                Converting holds the stock and turns the draft into a pending order. Record the deposit in the same
                step, or convert without a payment and record it later.
              </Trans>
            </RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="recordPayment">
              {(field) => <field.SwitchField label={t`Record a payment`} />}
            </form.AppField>
            <form.Subscribe selector={(state) => state.values.recordPayment}>
              {(recordPayment) =>
                recordPayment && (
                  <form.AppField name="amount">
                    {(field) => (
                      <field.TextField
                        label={t`Amount (${draftOrder.currencyCode.toUpperCase()})`}
                        description={t`Order total: ${total}`}
                        inputMode="decimal"
                        autoFocus
                      />
                    )}
                  </form.AppField>
                )
              }
            </form.Subscribe>
            {!!refusal && (
              <p role="alert" className="flex items-start gap-x-2 text-destructive text-sm">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{refusal}</span>
              </p>
            )}
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Convert</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
