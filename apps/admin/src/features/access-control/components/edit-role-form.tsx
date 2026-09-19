import { Badge, Button, Card, CardContent, CardHeader, CardTitle, KeyboundForm, Separator } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import type { AdminRoleDetailResponseRole } from '#/api/generated/model'
import { PageLayout } from '#/components/layout/page-layout'
import { PermissionGrid } from '#/features/access-control/components/permission-grid'
import { useEditRoleForm } from '#/features/access-control/hooks/use-edit-role-form'

export function EditRoleForm({ role }: { role: AdminRoleDetailResponseRole }) {
  const navigate = useNavigate()
  const isImmutable = role.isSuperAdmin
  const isNameDisabled = role.isSuperAdmin || role.protected

  const { form } = useEditRoleForm(role, {
    onSuccess: () => navigate({ to: '/settings/roles' }),
  })

  return (
    <PageLayout.SingleColumn>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-col gap-y-6">
        <form.AppForm>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-x-2">
                {role.name}
                {role.isSuperAdmin && <Badge variant="outline">Super Admin</Badge>}
                {role.protected && !role.isSuperAdmin && <Badge variant="outline">Protected</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-y-4">
              <form.AppField name="name">
                {(field) => <field.TextField label="Name" disabled={isNameDisabled} />}
              </form.AppField>
              <form.AppField name="description">
                {(field) => (
                  <field.TextareaField label="Description" placeholder="Optional description" disabled={isImmutable} />
                )}
              </form.AppField>
            </CardContent>
          </Card>

          {!isImmutable && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle>Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <form.Field name="features">
                    {(field) => <PermissionGrid value={field.state.value ?? []} onChange={field.handleChange} />}
                  </form.Field>
                </CardContent>
              </Card>
            </>
          )}

          <div className="flex justify-end gap-x-2">
            <Button variant="secondary" size="sm" onClick={() => navigate({ to: '/settings/roles' })}>
              {isImmutable ? 'Back' : 'Cancel'}
            </Button>
            {!isImmutable && <form.SubmitButton size="sm">Save</form.SubmitButton>}
          </div>
        </form.AppForm>
      </KeyboundForm>
    </PageLayout.SingleColumn>
  )
}
