import type { ModuleId, PermissionKey } from '@core/types/access-control/common.js'
import { GENERATED_FEATURES, type GeneratedFeature } from './features.gen.js'

export type FeatureDeclaration = GeneratedFeature

const featureMap = new Map<PermissionKey, FeatureDeclaration>(GENERATED_FEATURES.map((f) => [f.id, f]))

export function getRegisteredFeatures(): ReadonlyMap<PermissionKey, FeatureDeclaration> {
  return featureMap
}

export function getAllPermissionKeys(): PermissionKey[] {
  return [...featureMap.keys()]
}

export function getPermissionKeysByModule(moduleId: ModuleId): PermissionKey[] {
  return [...featureMap.values()].filter((f) => f.module === moduleId).map((f) => f.id)
}

export function registerFeatures(features: FeatureDeclaration[]): void {
  for (const feature of features) {
    featureMap.set(feature.id, feature)
  }
}

export function clearRegistry(): void {
  featureMap.clear()
}
