import { Button, toast } from '@proteus/ui'
import { DataTable } from '#/components/data-table'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { useInviteForm } from '#/features/users/hooks/use-invite-form'
import { useInviteTable } from '#/features/users/hooks/use-invite-table'

export function InviteForm() {
  const invites = useInviteTable()

  const { form, isLoading } = useInviteForm({
    onSuccess: () => toast.add({ type: 'success', title: 'Invite sent' }),
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteFocusModal.Header />

        <RouteFocusModal.Body className="mx-auto w-full max-w-180 px-6 py-16">
          <div className="flex items-end gap-x-3">
            <form.AppField name="email">
              {(field) => <field.TextField label="Email" type="email" autoFocus placeholder="user@example.com" />}
            </form.AppField>
            <Button type="submit" size="sm" disabled={isLoading}>
              Send Invite
            </Button>
          </div>
          <div className="mt-8">
            <DataTable use={invites} heading="Pending Invites" />
          </div>
        </RouteFocusModal.Body>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
