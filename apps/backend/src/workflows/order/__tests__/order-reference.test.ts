import { test } from '@tests/setup/test-extend.js'
import { orderReference } from '../utils/order-reference.js'

test.describe('orderReference', () => {
  test("carries the store's prefix, or is the bare display id without one", ({ expect }) => {
    expect(orderReference(1042, 'PDJ-')).toBe('PDJ-1042')
    expect(orderReference(1042, undefined)).toBe('1042')
  })
})
