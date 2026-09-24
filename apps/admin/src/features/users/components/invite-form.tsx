import { Trans, useLingui } from '@lingui/react/macro'
import { KeyboundForm, Label, RouteFocusModal, toast } from '@proteus/ui'
import { useMemo } from 'react'
import { DataTable } from '#/components/data-table/data-table'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useRolesList } from '#/features/users/api/user-roles'
import { useInviteForm } from '#/features/users/hooks/use-invite-form'
import { useInviteTable } from '#/features/users/hooks/use-invite-table'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function InviteForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const invites = useInviteTable()
  const { data: rolesData } = useRolesList()
  const roleItems = useMemo(() => rolesData?.roles.map((r) => ({ id: r.id, label: r.name })) ?? [], [rolesData])

  const { form } = useInviteForm({
    onSuccess: () => toast.add({ type: 'success', title: t`Invite sent` }),
  })

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header closeLabel={closeLabel} />

          <RouteFocusModal.Body>
            <div className="mx-auto w-full max-w-180 px-6 py-16">
              <div className="flex items-end gap-x-3">
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField label={t`Email`} type="email" autoFocus placeholder="user@example.com" />
                  )}
                </form.AppField>
                <form.SubmitButton size="sm">
                  <Trans>Send Invite</Trans>
                </form.SubmitButton>
              </div>
              <div className="mt-4">
                <Label>
                  <Trans>Roles</Trans>
                </Label>
                <form.AppField name="roleIds">
                  {(field) => (
                    <MultiSelectCombobox
                      items={roleItems}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      placeholder={t`Search roles...`}
                      emptyMessage={t`No roles found.`}
                    />
                  )}
                </form.AppField>
              </div>
              <div className="mt-8">
                <DataTable use={invites} heading={t`Pending Invites`} />
              </div>
            </div>
          </RouteFocusModal.Body>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
