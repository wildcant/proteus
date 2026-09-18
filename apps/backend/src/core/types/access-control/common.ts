type ProductPermission = 'product.read' | 'product.create' | 'product.update' | 'product.delete'

type OrderPermission =
  | 'order.read'
  | 'order.complete'
  | 'order.cancel'
  | 'order.archive'
  | 'order.fulfill'
  | 'order.ship'
  | 'order.deliver'

type CustomerPermission = 'customer.read' | 'customer.create' | 'customer.update' | 'customer.delete'

type PaymentPermission = 'payment.read' | 'payment.capture' | 'payment.refund'

type FulfillmentPermission =
  | 'fulfillment.read'
  | 'fulfillment.create'
  | 'fulfillment.update'
  | 'fulfillment.delete'

type InventoryPermission = 'inventory.read'

type RegionPermission = 'region.read' | 'region.create' | 'region.update'

type StorePermission = 'store.read' | 'store.update'

type UserPermission =
  | 'user.read'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.invite.read'
  | 'user.invite.create'
  | 'user.invite.delete'
  | 'user.invite.resend'

type NotificationPermission = 'notification.read'

type FilePermission = 'file.upload.read' | 'file.upload.create' | 'file.upload.delete'

type AccessControlPermission =
  | 'access-control.role.read'
  | 'access-control.role.manage'
  | 'access-control.assignment.read'
  | 'access-control.assignment.manage'

export type PermissionKey =
  | ProductPermission
  | OrderPermission
  | CustomerPermission
  | PaymentPermission
  | FulfillmentPermission
  | InventoryPermission
  | RegionPermission
  | StorePermission
  | UserPermission
  | NotificationPermission
  | FilePermission
  | AccessControlPermission

export type ModuleId =
  | 'product'
  | 'order'
  | 'customer'
  | 'payment'
  | 'fulfillment'
  | 'inventory'
  | 'region'
  | 'store'
  | 'user'
  | 'notification'
  | 'file'
  | 'access-control'

export type ModuleWildcard = `${ModuleId}.*`

export type PermissionGrant = PermissionKey | ModuleWildcard | '*'
