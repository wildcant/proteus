import type { PermissionGrant } from '@core/types/access-control/common.js'
import { describe, expect, test } from 'vitest'
import { hasAllFeatures, hasFeature, matchFeature, parseGrant, resolveEffectiveFeatures } from './engine.js'
import { GENERATED_FEATURES } from './features.gen.js'

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

describe('parseGrant', () => {
  test('classifies global, module wildcard and exact key', () => {
    expect(parseGrant('*')).toEqual({ kind: 'global' })
    expect(parseGrant('product.*')).toEqual({ kind: 'module', moduleId: 'product' })
    expect(parseGrant('user.invite.create')).toEqual({ kind: 'key', key: 'user.invite.create' })
  })
})

describe('resolveEffectiveFeatures', () => {
  test('expands * to all concrete keys', () => {
    const allKeys = GENERATED_FEATURES.map((f) => f.id)
    const result = resolveEffectiveFeatures(['*'])
    expect(result).toHaveLength(allKeys.length)
    for (const key of allKeys) {
      expect(result).toContain(key)
    }
  })

  test('expands product.* to all product keys', () => {
    const result = resolveEffectiveFeatures(['product.*'])
    const productKeys = GENERATED_FEATURES.filter((f) => f.module === 'product').map((f) => f.id)
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
