import { test } from '@tests/setup/test-extend.js'
import type { ModuleDefinition } from '../../../core/utils/module.js'
import { collectFeatures, getFeatureRegistry, resetFeatureRegistry } from '../index.js'

function stubModule(key: string, features: ModuleDefinition['features']): ModuleDefinition {
  return {
    key,
    service: class {} as ModuleDefinition['service'],
    repositories: {},
    models: {},
    features,
  }
}

test.describe('collectFeatures', () => {
  test.beforeEach(() => {
    resetFeatureRegistry()
  })

  test('collects features from module definitions into the registry', ({ expect }) => {
    collectFeatures(
      stubModule('product', [
        { id: 'product.read', title: 'View products' },
        { id: 'product.create', title: 'Create products' },
      ]),
    )
    collectFeatures(stubModule('order', [{ id: 'order.read', title: 'View orders' }]))

    const registry = getFeatureRegistry()
    expect(registry).toHaveLength(3)
    expect(registry[0]).toEqual({ id: 'product.read', title: 'View products', module: 'product' })
    expect(registry[1]).toEqual({ id: 'product.create', title: 'Create products', module: 'product' })
    expect(registry[2]).toEqual({ id: 'order.read', title: 'View orders', module: 'order' })
  })

  test('skips modules without features', ({ expect }) => {
    collectFeatures(stubModule('cart', undefined))
    expect(getFeatureRegistry()).toHaveLength(0)
  })

  test('throws on duplicate feature id across modules', ({ expect }) => {
    collectFeatures(stubModule('product', [{ id: 'product.read', title: 'View products' }]))

    expect(() => collectFeatures(stubModule('order', [{ id: 'product.read', title: 'Also view products' }]))).toThrow(
      'Duplicate feature id "product.read": declared by both "product" and "order"',
    )
  })
})
