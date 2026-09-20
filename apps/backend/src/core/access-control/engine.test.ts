import type { PermissionGrant } from '@core/types/access-control/common.js'
import { describe, expect, test } from 'vitest'
import { hasFeature, parseGrant, resolveEffectiveFeatures } from './engine.js'
import { GENERATED_FEATURES } from './features.gen.js'

describe('hasFeature', () => {
  test('* grants every permission', () => {
    const granted: PermissionGrant[] = ['*']
    expect(hasFeature(granted, 'product.read')).toBe(true)
    expect(hasFeature(granted, 'order.read')).toBe(true)
    expect(hasFeature(granted, 'user.invite.read')).toBe(true)
  })

  test('a module wildcard grants that module and no other', () => {
    const granted: PermissionGrant[] = ['product.*']
    expect(hasFeature(granted, 'product.read')).toBe(true)
    expect(hasFeature(granted, 'product.create')).toBe(true)
    expect(hasFeature(granted, 'order.read')).toBe(false)
  })

  test('an exact grant grants that key and no other', () => {
    const granted: PermissionGrant[] = ['product.read']
    expect(hasFeature(granted, 'product.read')).toBe(true)
    expect(hasFeature(granted, 'product.create')).toBe(false)
    expect(hasFeature(granted, 'order.read')).toBe(false)
  })

  test('finds match anywhere in granted array', () => {
    const granted: PermissionGrant[] = ['product.read', 'order.*']
    expect(hasFeature(granted, 'product.read')).toBe(true)
    expect(hasFeature(granted, 'order.complete')).toBe(true)
    expect(hasFeature(granted, 'user.read')).toBe(false)
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
    const productKeys = GENERATED_FEATURES.map((f) => f.id).filter((key) => key.startsWith('product.'))
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
