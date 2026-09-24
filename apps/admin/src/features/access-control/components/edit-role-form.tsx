import { Trans, useLingui } from '@lingui/react/macro'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, KeyboundForm, Separator } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import type { AdminRoleDetailResponseRole } from '#/api/generated/model'
import { PageLayout } from '#/components/layout/page-layout'
import { PermissionGrid } from '#/features/access-control/components/permission-grid'
import { useEditRoleForm } from '#/features/access-control/hooks/use-edit-role-form'

export function EditRoleForm({ role }: { role: AdminRoleDetailResponseRole }) {
  const { t } = useLingui()
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
                {!!role.isSuperAdmin && (
                  <Badge variant="outline">
                    <Trans>Super Admin</Trans>
                  </Badge>
                )}
                {!!role.protected && !role.isSuperAdmin && (
                  <Badge variant="outline">
                    <Trans>Protected</Trans>
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-y-4">
              <form.AppField name="name">
                {(field) => <field.TextField label={t`Name`} disabled={isNameDisabled} />}
              </form.AppField>
              <form.AppField name="description">
                {(field) => (
                  <field.TextareaField
                    label={t`Description`}
                    placeholder={t`Optional description`}
                    disabled={isImmutable}
                  />
                )}
              </form.AppField>
            </CardContent>
          </Card>

          {!isImmutable && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Trans>Permissions</Trans>
                  </CardTitle>
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
              {isImmutable ? t`Back` : t`Cancel`}
            </Button>
            {!isImmutable && (
              <form.SubmitButton size="sm">
                <Trans>Save</Trans>
              </form.SubmitButton>
            )}
          </div>
        </form.AppForm>
      </KeyboundForm>
    </PageLayout.SingleColumn>
  )
}
