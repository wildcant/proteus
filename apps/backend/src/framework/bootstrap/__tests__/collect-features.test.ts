import { test } from '@tests/setup/test-extend.js'
import { GENERATED_FEATURES } from '../../../core/access-control/features.gen.js'
import { getAllPermissionKeys, getRegisteredFeatures } from '../../../core/access-control/features.js'

test.describe('generated feature registry', () => {
  test('contains at least one feature', ({ expect }) => {
    expect(GENERATED_FEATURES.length).toBeGreaterThan(0)
  })

  test('has no duplicate ids', ({ expect }) => {
    const ids = GENERATED_FEATURES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('getRegisteredFeatures returns all generated features', ({ expect }) => {
    const map = getRegisteredFeatures()
    expect(map.size).toBe(GENERATED_FEATURES.length)
    for (const feature of GENERATED_FEATURES) {
      expect(map.get(feature.id)).toEqual(feature)
    }
  })

  test('getAllPermissionKeys returns all generated ids', ({ expect }) => {
    const keys = getAllPermissionKeys()
    expect(keys).toHaveLength(GENERATED_FEATURES.length)
    for (const feature of GENERATED_FEATURES) {
      expect(keys).toContain(feature.id)
    }
  })
})
