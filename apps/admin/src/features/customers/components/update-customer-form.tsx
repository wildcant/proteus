import { Button, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import type { AdminCustomer } from '#/api/generated/model'
import { useUpdateCustomerForm } from '#/features/customers/hooks/use-update-customer-form.ts'

export function UpdateCustomerForm({ customer }: { customer: AdminCustomer }) {
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
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">Edit Customer</h1>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <form.AppField name="firstName">
                  {(field) => <field.TextField label="First name" autoFocus placeholder="e.g. Ada" />}
                </form.AppField>
                <form.AppField name="lastName">
                  {(field) => <field.TextField label="Last name" placeholder="e.g. Lovelace" />}
                </form.AppField>
              </div>
              <form.AppField name="email">
                {(field) => <field.TextField label="Email" type="email" placeholder="e.g. ada@example.com" />}
              </form.AppField>
            </div>
          </RouteFocusModal.Body>
          <RouteFocusModal.Footer>
            <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
            <form.SubmitButton size="sm">Save</form.SubmitButton>
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
