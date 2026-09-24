import { useLingui } from '@lingui/react'
import type { AdminPermission } from '#/api/generated/model'
import { PERMISSION_TITLES } from '#/features/access-control/utils/permission-titles'

export function usePermissionTitle(): (permission: Pick<AdminPermission, 'key' | 'title'>) => string {
  const { i18n } = useLingui()
  return (permission) => {
    const message = PERMISSION_TITLES[permission.key]
    return message ? i18n._(message) : permission.title
  }
}
