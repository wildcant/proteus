import type { ModuleId, PermissionGrant, PermissionKey } from '@core/types/access-control/common.js'

export type AuthorizationActor = {
  id: string
  type: 'user' | 'system'
}

export type AuthorizationScope = {
  moduleId: ModuleId
  resourceId?: string
}

export type AuthorizationContext = {
  actor: AuthorizationActor
  grants: PermissionGrant[]
  enabledModules: ModuleId[]
  unrestricted?: boolean
}

export type AuthorizationRequest = {
  required: PermissionKey[]
  scope?: AuthorizationScope
}

export type AuthorizationDecision = {
  allowed: boolean
  missing: PermissionKey[]
}

export type AuthorizationFilter = {
  moduleId: ModuleId
  grants: PermissionGrant[]
}

export type FieldAuthorization = {
  field: string
  requiredPermission: PermissionKey
  allowed: boolean
}
