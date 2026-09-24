import { Trans } from '@lingui/react/macro'
import { Checkbox, Label } from '@proteus/ui'
import { useMemo } from 'react'
import type { AdminPermission } from '#/api/generated/model'
import { usePermissions } from '#/features/access-control/api/permissions'
import { usePermissionTitle } from '#/features/access-control/hooks/use-permission-title'

type PermissionGridProps = {
  value: string[]
  onChange: (features: string[]) => void
}

type ModuleGroup = {
  module: string
  permissions: AdminPermission[]
}

/** A key's first segment is its module — `user.invite.read` belongs to `user`. */
function moduleOfKey(key: string): string {
  return key.slice(0, key.indexOf('.'))
}

function groupByModule(permissions: AdminPermission[]): ModuleGroup[] {
  const map = new Map<string, AdminPermission[]>()
  for (const p of permissions) {
    if (!p.assignable) continue
    const module = moduleOfKey(p.key)
    const list = map.get(module) ?? []
    list.push(p)
    map.set(module, list)
  }
  return Array.from(map.entries())
    .map(([module, perms]) => ({ module, permissions: perms }))
    .sort((a, b) => a.module.localeCompare(b.module))
}

function hasWildcard(features: string[], module: string): boolean {
  return features.includes(`${module}.*`)
}

function modulePermissionKeys(permissions: AdminPermission[]): string[] {
  return permissions.map((p) => p.key)
}

export function PermissionGrid({ value, onChange }: PermissionGridProps) {
  const { data } = usePermissions()
  const permissionTitle = usePermissionTitle()
  const groups = useMemo(() => groupByModule(data?.permissions ?? []), [data?.permissions])

  const handleAllToggle = (module: string, permissions: AdminPermission[]) => {
    const wildcard = `${module}.*`
    if (hasWildcard(value, module)) {
      onChange(value.filter((f) => f !== wildcard))
    } else {
      const keys = modulePermissionKeys(permissions)
      const cleaned = value.filter((f) => !keys.includes(f) && f !== wildcard)
      onChange([...cleaned, wildcard])
    }
  }

  const handlePermissionToggle = (key: string, module: string, permissions: AdminPermission[]) => {
    const wildcard = `${module}.*`
    const isWildcard = hasWildcard(value, module)

    if (isWildcard) {
      const allKeys = modulePermissionKeys(permissions)
      const remaining = allKeys.filter((k) => k !== key)
      const cleaned = value.filter((f) => f !== wildcard)
      onChange([...cleaned, ...remaining])
    } else if (value.includes(key)) {
      onChange(value.filter((f) => f !== key))
    } else {
      const allKeys = modulePermissionKeys(permissions)
      const newValue = [...value, key]
      const allSelected = allKeys.every((k) => newValue.includes(k))
      if (allSelected) {
        const cleaned = newValue.filter((f) => !allKeys.includes(f))
        onChange([...cleaned, wildcard])
      } else {
        onChange(newValue)
      }
    }
  }

  const isChecked = (key: string, module: string): boolean => {
    return hasWildcard(value, module) || value.includes(key)
  }

  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        <Trans>No permissions registered.</Trans>
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {groups.map((group) => {
        const module = group.module
        return (
          <div key={group.module} className="space-y-3">
            <div className="flex items-center gap-x-2 border-b pb-2">
              <Checkbox
                id={`module-${group.module}`}
                checked={hasWildcard(value, group.module)}
                onCheckedChange={() => handleAllToggle(group.module, group.permissions)}
              />
              <Label htmlFor={`module-${group.module}`} className="font-medium text-sm capitalize">
                <Trans>{module} — All</Trans>
              </Label>
            </div>
            <div className="space-y-2 pl-1">
              {group.permissions.map((permission) => (
                <div key={permission.id} className="flex items-start gap-x-2">
                  <Checkbox
                    id={`perm-${permission.id}`}
                    checked={isChecked(permission.key, group.module)}
                    onCheckedChange={() => handlePermissionToggle(permission.key, group.module, group.permissions)}
                  />
                  <div className="flex flex-col">
                    <Label htmlFor={`perm-${permission.id}`} className="text-sm">
                      {permissionTitle(permission)}
                    </Label>
                    <span className="text-muted-foreground text-xs">{permission.key}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
