import type { ModuleId, PermissionKey } from '@core/types/access-control/common.js'

export type FeatureDeclaration = {
  id: PermissionKey
  title: string
  module: ModuleId
}

const registry = new Map<PermissionKey, FeatureDeclaration>()

export function registerFeature(feature: FeatureDeclaration): void {
  const existing = registry.get(feature.id)
  if (existing && existing.module !== feature.module) {
    throw new Error(
      `Duplicate feature "${feature.id}" registered by modules "${existing.module}" and "${feature.module}"`,
    )
  }
  registry.set(feature.id, feature)
}

export function registerFeatures(features: FeatureDeclaration[]): void {
  for (const feature of features) {
    registerFeature(feature)
  }
}

export function getRegisteredFeatures(): ReadonlyMap<PermissionKey, FeatureDeclaration> {
  return registry
}

export function getAllPermissionKeys(): PermissionKey[] {
  return [...registry.keys()]
}

export function getPermissionKeysByModule(moduleId: ModuleId): PermissionKey[] {
  return [...registry.values()].filter((f) => f.module === moduleId).map((f) => f.id)
}

export function clearRegistry(): void {
  registry.clear()
}
