import { test } from '@tests/setup/test-extend.js'
import { GENERATED_FEATURES } from '../../../core/access-control/features.gen.js'

test.describe('generated feature registry', () => {
  test('contains at least one feature', ({ expect }) => {
    expect(GENERATED_FEATURES.length).toBeGreaterThan(0)
  })

  test('has no duplicate ids', ({ expect }) => {
    const ids = GENERATED_FEATURES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
