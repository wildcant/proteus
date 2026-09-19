type CrudAction = 'read' | 'create' | 'update' | 'delete'

type ProductModuleId = 'product'
type ProductPermission = `${ProductModuleId}.${CrudAction}`

type OrderAction = 'read' | 'complete' | 'cancel' | 'archive' | 'fulfill' | 'ship' | 'deliver'
type OrderModuleId = 'order'
type OrderPermission = `${OrderModuleId}.${OrderAction}`

type CustomerModuleId = 'customer'
type CustomerPermission = `${CustomerModuleId}.${CrudAction}`

type PaymentAction = 'read' | 'capture' | 'refund'
type PaymentModuleId = 'payment'
type PaymentPermission = `${PaymentModuleId}.${PaymentAction}`

type FulfillmentModuleId = 'fulfillment'
type FulfillmentPermission = `${FulfillmentModuleId}.${CrudAction}`

type InventoryModuleId = 'inventory'
type InventoryPermission = `${InventoryModuleId}.read`

type RegionAction = 'read' | 'create' | 'update'
type RegionModuleId = 'region'
type RegionPermission = `${RegionModuleId}.${RegionAction}`

type StoreAction = 'read' | 'update'
type StoreModuleId = 'store'
type StorePermission = `${StoreModuleId}.${StoreAction}`

type UserAction = 'read' | 'create' | 'update' | 'delete'
type UserSubModel = 'invite'
type UserInviteAction = 'read' | 'create' | 'delete' | 'resend'
type UserModuleId = 'user'
type UserPermission = `${UserModuleId}.${UserAction}` | `${UserModuleId}.${UserSubModel}.${UserInviteAction}`

type NotificationModuleId = 'notification'
type NotificationPermission = `${NotificationModuleId}.read`

type FileSubModel = 'upload'
type FileUploadAction = 'read' | 'create' | 'delete'
type FileModuleId = 'file'
type FilePermission = `${FileModuleId}.${FileSubModel}.${FileUploadAction}`

type AccessControlSubModel = 'role' | 'assignment'
type AccessControlRoleAction = 'read' | 'manage'
type AccessControlModuleId = 'access-control'
type AccessControlPermission = `${AccessControlModuleId}.${AccessControlSubModel}.${AccessControlRoleAction}`

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
  | ProductModuleId
  | OrderModuleId
  | CustomerModuleId
  | PaymentModuleId
  | FulfillmentModuleId
  | InventoryModuleId
  | RegionModuleId
  | StoreModuleId
  | UserModuleId
  | NotificationModuleId
  | FileModuleId
  | AccessControlModuleId

export type ModuleWildcard = `${ModuleId}.*`

export type PermissionGrant = PermissionKey | ModuleWildcard | '*'
