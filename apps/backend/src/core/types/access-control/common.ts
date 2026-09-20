import { Modules } from '../../utils/modules-definition.js'

type CrudAction = 'read' | 'create' | 'update' | 'delete'

/**
 * Every permission the system knows, as one map from module id to the actions that module grants.
 * `ModuleId` and `PermissionKey` both derive from it, and the keys come from `Modules`, so no
 * permission can name a module that does not exist. Modules with no permissions are simply absent.
 * A module that owns several resources nests them (`invite.read`); a module with one does not
 * (`inventory.read`).
 */
type ModuleActions = {
  [Modules.PRODUCT]: CrudAction
  [Modules.ORDER]: 'read' | 'complete' | 'cancel' | 'archive' | 'fulfill' | 'ship' | 'deliver'
  [Modules.CUSTOMER]: CrudAction
  [Modules.PAYMENT]: 'read' | 'capture' | 'refund'
  [Modules.FULFILLMENT]: CrudAction
  [Modules.INVENTORY]: 'read'
  [Modules.REGION]: 'read' | 'create' | 'update'
  [Modules.STORE]: 'read' | 'update'
  [Modules.USER]: CrudAction | `invite.${'read' | 'create' | 'delete' | 'resend'}`
  [Modules.NOTIFICATION]: 'read'
  [Modules.FILE]: 'read' | 'create' | 'delete'
  [Modules.ACCESS_CONTROL]: `${'role' | 'assignment'}.${'read' | 'write'}`
}

export type ModuleId = keyof ModuleActions

export type PermissionKey = { [Module in ModuleId]: `${Module}.${ModuleActions[Module]}` }[ModuleId]

export type PermissionGrant = PermissionKey | `${ModuleId}.*` | '*'
