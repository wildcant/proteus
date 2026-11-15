import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminDraftOrderResponseDraftOrder } from '#/api/generated/model'
import { useShippingOptions } from '#/features/draft-orders/api/shipping-options'
import { useEditDraftShippingForm } from '#/features/draft-orders/hooks/use-edit-draft-shipping-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditDraftShippingForm({ draftOrder }: { draftOrder: AdminDraftOrderResponseDraftOrder }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { form } = useEditDraftShippingForm(draftOrder, { onSuccess: () => handleSuccess() })

  // Every enabled option is offered; the server refuses one that does not serve the draft's address.
  const { data } = useShippingOptions()
  const options = (data?.shippingOptions ?? [])
    .filter((option) => option.isEnabled)
    .map((option) => ({
      id: option.id,
      label: option.priceType === 'calculated' ? t`${option.name} (calculated)` : option.name,
    }))
  const currency = draftOrder.currencyCode.toUpperCase()

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Edit shipping</Trans>
            </RouteDrawer.Title>
            <RouteDrawer.Description>
              <Trans>Pick how the order ships, and override its price with what you agreed in the chat.</Trans>
            </RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="shippingOption">
              {(field) => (
                <field.SingleComboboxField
                  label={t`Shipping option`}
                  items={options}
                  placeholder={t`Search shipping options...`}
                  emptyMessage={t`No shipping options.`}
                />
              )}
            </form.AppField>
            <form.AppField name="customAmount">
              {(field) => (
                <field.TextField
                  label={t`Custom amount (${currency})`}
                  description={t`Leave empty to use the option's price.`}
                  inputMode="decimal"
                  placeholder={t`Optional`}
                />
              )}
            </form.AppField>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
