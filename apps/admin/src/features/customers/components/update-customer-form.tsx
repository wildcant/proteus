import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import type { AdminCustomer } from '#/api/generated/model'
import { useUpdateCustomerForm } from '#/features/customers/hooks/use-update-customer-form.ts'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function UpdateCustomerForm({ customer }: { customer: AdminCustomer }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useUpdateCustomerForm({
    id: customer.id,
    defaultValues: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
    },
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header closeLabel={closeLabel} />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">
                  <Trans>Edit Customer</Trans>
                </h1>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <form.AppField name="firstName">
                  {(field) => <field.TextField label={t`First name`} autoFocus placeholder={t`e.g. Ada`} />}
                </form.AppField>
                <form.AppField name="lastName">
                  {(field) => <field.TextField label={t`Last name`} placeholder={t`e.g. Lovelace`} />}
                </form.AppField>
              </div>
              <form.AppField name="email">
                {(field) => <field.TextField label={t`Email`} type="email" placeholder={t`e.g. ada@example.com`} />}
              </form.AppField>
            </div>
          </RouteFocusModal.Body>
          <RouteFocusModal.Footer>
            <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteFocusModal.Close>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
