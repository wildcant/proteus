import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

/**
 * The sidebar labels `/admin/users/me` sends, as admin copy. The backend builds the sidebar from
 * permissions and names each entry in English; the admin owns the language, so it translates them
 * here. A label missing from this map renders as sent.
 */
const SIDEBAR_LABELS: Record<string, MessageDescriptor> = {
  Store: msg`Store`,
  Orders: msg`Orders`,
  Products: msg`Products`,
  Options: msg`Options`,
  Customers: msg`Customers`,
  Inventory: msg`Inventory`,
  Reservations: msg`Reservations`,
  General: msg`General`,
  Users: msg`Users`,
  Roles: msg`Roles`,
  Regions: msg`Regions`,
}

export function useSidebarLabel(): (label: string) => string {
  const { i18n } = useLingui()
  return (label) => {
    const message = SIDEBAR_LABELS[label]
    return message ? i18n._(message) : label
  }
}
