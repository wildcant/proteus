import { KeyboundForm, RouteFocusModal, toast } from '@proteus/ui'
import { DataTable } from '#/components/data-table/data-table'
import { useInviteForm } from '#/features/users/hooks/use-invite-form'
import { useInviteTable } from '#/features/users/hooks/use-invite-table'

export function InviteForm() {
  const invites = useInviteTable()

  const { form } = useInviteForm({
    onSuccess: () => toast.add({ type: 'success', title: 'Invite sent' }),
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header />

          <RouteFocusModal.Body>
            <div className="mx-auto w-full max-w-180 px-6 py-16">
              <div className="flex items-end gap-x-3">
                <form.AppField name="email">
                  {(field) => <field.TextField label="Email" type="email" autoFocus placeholder="user@example.com" />}
                </form.AppField>
                <form.SubmitButton size="sm">Send Invite</form.SubmitButton>
              </div>
              <div className="mt-8">
                <DataTable use={invites} heading="Pending Invites" />
              </div>
            </div>
          </RouteFocusModal.Body>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
