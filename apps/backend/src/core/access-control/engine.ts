import type { ModuleId, PermissionGrant, PermissionKey } from '@core/types/access-control/common.js'
import { GENERATED_FEATURES } from './features.gen.js'

export type ParsedGrant =
  | { kind: 'global' }
  | { kind: 'module'; moduleId: ModuleId }
  | { kind: 'key'; key: PermissionKey }

export function parseGrant(grant: PermissionGrant): ParsedGrant {
  if (grant === '*') return { kind: 'global' }
  if (grant.endsWith('.*')) return { kind: 'module', moduleId: grant.slice(0, -2) as ModuleId }
  return { kind: 'key', key: grant as PermissionKey }
}

export function matchFeature(required: PermissionKey, granted: PermissionGrant): boolean {
  const parsed = parseGrant(granted)
  if (parsed.kind === 'global') return true
  if (parsed.kind === 'module') return required.startsWith(`${parsed.moduleId}.`)
  return parsed.key === required
}

export function hasFeature(granted: PermissionGrant[], required: PermissionKey): boolean {
  return granted.some((g) => matchFeature(required, g))
}

export function hasAllFeatures(granted: PermissionGrant[], required: PermissionKey[]): boolean {
  return required.every((r) => hasFeature(granted, r))
}

export function resolveEffectiveFeatures(granted: PermissionGrant[]): PermissionKey[] {
  const allKeys = GENERATED_FEATURES.map((f) => f.id)
  const result = new Set<PermissionKey>()

  for (const grant of granted) {
    const parsed = parseGrant(grant)

    if (parsed.kind === 'global') {
      return [...allKeys]
    }

    if (parsed.kind === 'module') {
      for (const key of allKeys) {
        if (matchFeature(key, grant)) {
          result.add(key)
        }
      }
      continue
    }

    result.add(parsed.key)
  }

  return [...result]
}
