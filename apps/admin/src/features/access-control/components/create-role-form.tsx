import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal, Separator, useRouteModal } from '@proteus/ui'
import { PermissionGrid } from '#/features/access-control/components/permission-grid'
import { useCreateRoleForm } from '#/features/access-control/hooks/use-create-role-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function CreateRoleForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useCreateRoleForm({
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header closeLabel={closeLabel} />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">
                  <Trans>Create Role</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>Roles define what actions users can perform. Assign permissions to control access.</Trans>
                </p>
              </div>
              <div className="flex flex-col gap-y-4">
                <form.AppField name="name">
                  {(field) => <field.TextField label={t`Name`} autoFocus placeholder={t`e.g. Store Manager`} />}
                </form.AppField>
                <form.AppField name="description">
                  {(field) => <field.TextareaField label={t`Description`} placeholder={t`Optional description`} />}
                </form.AppField>
              </div>
              <Separator />
              <div>
                <h2 className="mb-4 font-medium text-lg">
                  <Trans>Permissions</Trans>
                </h2>
                <form.Field name="features">
                  {(field) => <PermissionGrid value={field.state.value ?? []} onChange={field.handleChange} />}
                </form.Field>
              </div>
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
