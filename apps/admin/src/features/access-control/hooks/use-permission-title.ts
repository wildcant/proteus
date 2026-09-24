import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { AdminPermission } from '#/api/generated/model'

/**
 * The permission titles `/admin/permissions` sends, as admin copy, by permission key. The backend
 * names each feature in English; the admin owns the language, so it translates them here. The key
 * itself stays technical and untranslated. A key missing from this map renders its title as sent.
 */
export const PERMISSION_TITLES: Record<string, MessageDescriptor> = {
  'access-control.role.read': msg`View roles`,
  'access-control.role.write': msg`Manage roles`,
  'access-control.assignment.read': msg`View role assignments`,
  'access-control.assignment.write': msg`Manage role assignments`,
  'customer.read': msg`View customers`,
  'customer.create': msg`Create customers`,
  'customer.update': msg`Edit customers`,
  'customer.delete': msg`Delete customers`,
  'file.read': msg`View uploads`,
  'file.create': msg`Upload files`,
  'file.delete': msg`Delete uploads`,
  'fulfillment.read': msg`View fulfillments`,
  'fulfillment.create': msg`Create fulfillments`,
  'fulfillment.update': msg`Edit fulfillments`,
  'fulfillment.delete': msg`Delete fulfillments`,
  'inventory.read': msg`View inventory`,
  'notification.read': msg`View notifications`,
  'order.read': msg`View orders`,
  'order.complete': msg`Complete orders`,
  'order.cancel': msg`Cancel orders`,
  'order.archive': msg`Archive orders`,
  'order.fulfill': msg`Fulfill orders`,
  'order.ship': msg`Ship orders`,
  'order.deliver': msg`Deliver orders`,
  'payment.read': msg`View payments`,
  'payment.capture': msg`Capture payments`,
  'payment.refund': msg`Refund payments`,
  'product.read': msg`View products`,
  'product.create': msg`Create products`,
  'product.update': msg`Edit products`,
  'product.delete': msg`Delete products`,
  'region.read': msg`View regions`,
  'region.create': msg`Create regions`,
  'region.update': msg`Edit regions`,
  'store.read': msg`View store settings`,
  'store.update': msg`Edit store settings`,
  'user.read': msg`View users`,
  'user.create': msg`Create users`,
  'user.update': msg`Edit users`,
  'user.delete': msg`Delete users`,
  'user.invite.read': msg`View invites`,
  'user.invite.create': msg`Create invites`,
  'user.invite.delete': msg`Delete invites`,
  'user.invite.resend': msg`Resend invites`,
}

export function usePermissionTitle(): (permission: Pick<AdminPermission, 'key' | 'title'>) => string {
  const { i18n } = useLingui()
  return (permission) => {
    const message = PERMISSION_TITLES[permission.key]
    return message ? i18n._(message) : permission.title
  }
}
