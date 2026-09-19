import type { ModuleId, PermissionGrant, PermissionKey } from '@core/types/access-control/common.js'

type AuthorizationActor = {
  id: string
  type: 'user' | 'system'
}

export type AuthorizationContext = {
  actor: AuthorizationActor
  grants: PermissionGrant[]
  enabledModules: ModuleId[]
  unrestricted?: boolean
}

export type AuthorizationDecision = {
  allowed: boolean
  missing: PermissionKey[]
}
