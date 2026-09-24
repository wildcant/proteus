import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@proteus/ui'
import { useEffect, useState } from 'react'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useReplaceUserRoles, useSuspenseRolesList, useSuspenseUserRoles } from '#/features/users/api/user-roles'

export function UserRoleAssignment({ userId }: { userId: string }) {
  const { t } = useLingui()
  const { data: rolesData } = useSuspenseRolesList()
  const { data: userRolesData } = useSuspenseUserRoles(userId)

  const currentRoleIds = userRolesData.roles.map((r) => r.id)
  const serializedRoleIds = currentRoleIds.join(',')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(currentRoleIds)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setSelectedRoleIds(serializedRoleIds.split(',').filter(Boolean))
    setDirty(false)
  }, [serializedRoleIds])

  const replaceRoles = useReplaceUserRoles(userId, {
    onSuccess: () => {
      setDirty(false)
    },
  })

  const items = rolesData.roles.map((role) => ({ id: role.id, label: role.name }))

  const handleChange = (ids: string[]) => {
    setSelectedRoleIds(ids)
    setDirty(true)
  }

  const handleSave = () => {
    replaceRoles.mutate(selectedRoleIds)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Roles</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MultiSelectCombobox
          items={items}
          value={selectedRoleIds}
          onValueChange={handleChange}
          placeholder={t`Search roles...`}
          emptyMessage={t`No roles found.`}
        />
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || replaceRoles.isPending} size="sm">
            {replaceRoles.isPending ? t`Saving...` : t`Save roles`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
