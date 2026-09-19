import type { ModuleId, PermissionGrant, PermissionKey } from '@core/types/access-control/common.js'
import { getAllPermissionKeys } from './features.js'
import type { AuthorizationContext, AuthorizationDecision } from './types.js'

export function matchFeature(required: PermissionKey, granted: PermissionGrant): boolean {
  if (granted === '*') return true
  if (granted === required) return true
  if (granted.endsWith('.*')) {
    const prefix = granted.slice(0, -1)
    return required.startsWith(prefix)
  }
  return false
}

export function hasFeature(granted: PermissionGrant[], required: PermissionKey): boolean {
  return granted.some((g) => matchFeature(required, g))
}

export function hasAllFeatures(granted: PermissionGrant[], required: PermissionKey[]): boolean {
  return required.every((r) => hasFeature(granted, r))
}

export function authorizeFeatures(required: PermissionKey[], subject: AuthorizationContext): AuthorizationDecision {
  if (subject.unrestricted) {
    return { allowed: true, missing: [] }
  }

  const activeGrants = filterGrantsByEnabledModules(subject.grants, subject.enabledModules)
  const missing = required.filter((r) => !hasFeature(activeGrants, r))

  return {
    allowed: missing.length === 0,
    missing,
  }
}

export function resolveEffectiveFeatures(granted: PermissionGrant[]): PermissionKey[] {
  const allKeys = getAllPermissionKeys()
  const result = new Set<PermissionKey>()

  for (const grant of granted) {
    if (grant === '*') {
      return [...allKeys]
    }
    if (grant.endsWith('.*')) {
      const prefix = grant.slice(0, -1)
      for (const key of allKeys) {
        if (key.startsWith(prefix)) {
          result.add(key)
        }
      }
    } else {
      result.add(grant as PermissionKey)
    }
  }

  return [...result]
}

export function filterGrantsByEnabledModules(grants: PermissionGrant[], enabledModules: ModuleId[]): PermissionGrant[] {
  const result: PermissionGrant[] = []
  for (const grant of grants) {
    if (grant === '*') {
      for (const moduleId of enabledModules) {
        result.push(`${moduleId}.*`)
      }
    } else {
      const moduleId = grant.split('.')[0] as ModuleId
      if (enabledModules.includes(moduleId)) {
        result.push(grant)
      }
    }
  }
  return result
}
