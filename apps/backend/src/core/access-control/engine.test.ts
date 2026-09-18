import { beforeEach, describe, expect, test } from 'vitest'
import type { PermissionGrant, PermissionKey } from '@core/types/access-control/common.js'
import type { AuthorizationContext } from './types.js'
import {
  matchFeature,
  hasFeature,
  hasAllFeatures,
  authorizeFeatures,
  resolveEffectiveFeatures,
  filterGrantsByEnabledModules,
} from './engine.js'
import { clearRegistry, registerFeatures } from './features.js'

const ALL_FEATURES = [
  { id: 'product.read' as PermissionKey, title: 'View products', module: 'product' as const },
  { id: 'product.create' as PermissionKey, title: 'Create products', module: 'product' as const },
  { id: 'product.update' as PermissionKey, title: 'Edit products', module: 'product' as const },
  { id: 'product.delete' as PermissionKey, title: 'Delete products', module: 'product' as const },
  {
    id: 'product.option.read' as PermissionKey,
    title: 'View product options',
    module: 'product' as const,
  },
  { id: 'order.read' as PermissionKey, title: 'View orders', module: 'order' as const },
  { id: 'order.complete' as PermissionKey, title: 'Complete orders', module: 'order' as const },
  { id: 'user.read' as PermissionKey, title: 'View users', module: 'user' as const },
  {
    id: 'user.invite.read' as PermissionKey,
    title: 'View invites',
    module: 'user' as const,
  },
  { id: 'payment.read' as PermissionKey, title: 'View payments', module: 'payment' as const },
]

beforeEach(() => {
  clearRegistry()
  registerFeatures(ALL_FEATURES)
})

describe('matchFeature', () => {
  test('* matches any required permission', () => {
    expect(matchFeature('product.read', '*')).toBe(true)
    expect(matchFeature('order.read', '*')).toBe(true)
    expect(matchFeature('user.invite.read', '*')).toBe(true)
  })

  test('product.* matches product.read and product.create but not order.read', () => {
    expect(matchFeature('product.read', 'product.*')).toBe(true)
    expect(matchFeature('product.create', 'product.*')).toBe(true)
    expect(matchFeature('order.read', 'product.*')).toBe(false)
  })

  test('product.* matches product.option.read (sub-model via prefix)', () => {
    expect(matchFeature('product.option.read' as PermissionKey, 'product.*')).toBe(true)
  })

  test('exact match: product.read matches product.read only', () => {
    expect(matchFeature('product.read', 'product.read')).toBe(true)
    expect(matchFeature('product.create', 'product.read')).toBe(false)
    expect(matchFeature('order.read', 'product.read')).toBe(false)
  })
})

describe('hasFeature', () => {
  test('finds match in granted array', () => {
    const granted: PermissionGrant[] = ['product.read', 'order.*']
    expect(hasFeature(granted, 'product.read')).toBe(true)
    expect(hasFeature(granted, 'order.complete')).toBe(true)
    expect(hasFeature(granted, 'user.read')).toBe(false)
  })
})

describe('hasAllFeatures', () => {
  test('returns true when all required features are granted', () => {
    const granted: PermissionGrant[] = ['product.*', 'order.read']
    expect(hasAllFeatures(granted, ['product.read', 'product.create', 'order.read'])).toBe(true)
  })

  test('returns false when any required feature is missing', () => {
    const granted: PermissionGrant[] = ['product.read']
    expect(hasAllFeatures(granted, ['product.read', 'order.read'])).toBe(false)
  })
})

describe('authorizeFeatures', () => {
  test('short-circuits on unrestricted: true', () => {
    const subject: AuthorizationContext = {
      actor: { id: 'system', type: 'system' },
      grants: [],
      enabledModules: [],
      unrestricted: true,
    }
    const result = authorizeFeatures(['product.read', 'order.read'], subject)
    expect(result.allowed).toBe(true)
    expect(result.missing).toEqual([])
  })

  test('returns false when required features come from disabled modules', () => {
    const subject: AuthorizationContext = {
      actor: { id: 'user-1', type: 'user' },
      grants: ['product.*', 'order.*'],
      enabledModules: ['product'],
    }
    const result = authorizeFeatures(['product.read', 'order.read'], subject)
    expect(result.allowed).toBe(false)
    expect(result.missing).toEqual(['order.read'])
  })

  test('allows when all required features are granted and modules enabled', () => {
    const subject: AuthorizationContext = {
      actor: { id: 'user-1', type: 'user' },
      grants: ['product.*'],
      enabledModules: ['product'],
    }
    const result = authorizeFeatures(['product.read', 'product.create'], subject)
    expect(result.allowed).toBe(true)
    expect(result.missing).toEqual([])
  })
})

describe('resolveEffectiveFeatures', () => {
  test('expands * to all concrete keys', () => {
    const result = resolveEffectiveFeatures(['*'])
    expect(result).toHaveLength(ALL_FEATURES.length)
    for (const feature of ALL_FEATURES) {
      expect(result).toContain(feature.id)
    }
  })

  test('expands product.* to all product keys', () => {
    const result = resolveEffectiveFeatures(['product.*'])
    const productKeys = ALL_FEATURES.filter((f) => f.module === 'product').map((f) => f.id)
    expect(result).toHaveLength(productKeys.length)
    for (const key of productKeys) {
      expect(result).toContain(key)
    }
  })

  test('does not include wildcards in output', () => {
    const result = resolveEffectiveFeatures(['product.*', '*'])
    for (const key of result) {
      expect(key).not.toContain('*')
    }
  })

  test('includes exact grants directly', () => {
    const result = resolveEffectiveFeatures(['product.read', 'order.read'])
    expect(result).toContain('product.read')
    expect(result).toContain('order.read')
    expect(result).toHaveLength(2)
  })
})

describe('filterGrantsByEnabledModules', () => {
  test('keeps * regardless of enabled modules', () => {
    const result = filterGrantsByEnabledModules(['*'], ['product'])
    expect(result).toEqual(['*'])
  })

  test('filters out grants from disabled modules', () => {
    const grants: PermissionGrant[] = ['product.read', 'order.read', 'user.*']
    const result = filterGrantsByEnabledModules(grants, ['product', 'user'])
    expect(result).toEqual(['product.read', 'user.*'])
  })
})
