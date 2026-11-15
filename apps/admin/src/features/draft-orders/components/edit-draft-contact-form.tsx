import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminDraftOrderResponseDraftOrder } from '#/api/generated/model'
import { useEditDraftContactForm } from '#/features/draft-orders/hooks/use-edit-draft-contact-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditDraftContactForm({ draftOrder }: { draftOrder: AdminDraftOrderResponseDraftOrder }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { form } = useEditDraftContactForm(draftOrder, { onSuccess: () => handleSuccess() })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Edit customer</Trans>
            </RouteDrawer.Title>
            <RouteDrawer.Description>
              <Trans>Record what the shopper told you in the chat.</Trans>
            </RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <div className="grid grid-cols-2 gap-4">
              <form.AppField name="firstName">
                {(field) => <field.TextField label={t`First name`} autoFocus />}
              </form.AppField>
              <form.AppField name="lastName">{(field) => <field.TextField label={t`Last name`} />}</form.AppField>
            </div>
            <form.AppField name="phone">
              {(field) => <field.TextField label={t`Phone`} type="tel" autoComplete="off" />}
            </form.AppField>
            <form.AppField name="email">
              {(field) => <field.TextField label={t`Email`} type="email" placeholder={t`Optional`} />}
            </form.AppField>
            <form.AppField name="company">
              {(field) => <field.TextField label={t`Company`} placeholder={t`Optional`} />}
            </form.AppField>
            <form.AppField name="address1">{(field) => <field.TextField label={t`Address`} />}</form.AppField>
            <form.AppField name="address2">
              {(field) => <field.TextField label={t`Apartment, suite, etc.`} placeholder={t`Optional`} />}
            </form.AppField>
            <div className="grid grid-cols-2 gap-4">
              <form.AppField name="city">{(field) => <field.TextField label={t`City`} />}</form.AppField>
              <form.AppField name="province">{(field) => <field.TextField label={t`Province`} />}</form.AppField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <form.AppField name="postalCode">
                {(field) => <field.TextField label={t`Postal code`} placeholder={t`Optional`} />}
              </form.AppField>
              <form.AppField name="countryCode">
                {(field) => (
                  <field.TextField label={t`Country code`} description={t`Two letters, e.g. CO`} autoComplete="off" />
                )}
              </form.AppField>
            </div>
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
