import type { SavedMethodDTO } from '@core/types/payment/common.js'
import { expect, test } from 'vitest'
import { orderSavedMethods } from '../utils/saved-methods.js'

/**
 * The wallet's order, on its own.
 *
 * It is asserted here as well as through the routes because it is the one rule two storefront
 * surfaces both consume: the checkout selector and the account page render the same list, and a
 * second opinion about the order is how they come to disagree.
 */

const method = (id: string, createdAt: string, isDefault = false): SavedMethodDTO => ({
  id,
  brand: 'visa',
  last4: '4242',
  expMonth: 1,
  expYear: 2031,
  isDefault,
  createdAt: new Date(createdAt),
})

test('puts the default first, then the most recent', () => {
  const ordered = orderSavedMethods([
    method('pm_old', '2026-01-01T00:00:00Z'),
    method('pm_default', '2025-01-01T00:00:00Z', true),
    method('pm_new', '2026-06-01T00:00:00Z'),
  ])

  expect(ordered.map((saved) => saved.id)).toEqual(['pm_default', 'pm_new', 'pm_old'])
})

test('leaves the gateway order alone when two cards were stored at the same moment', () => {
  const ordered = orderSavedMethods([method('pm_a', '2026-01-01T00:00:00Z'), method('pm_b', '2026-01-01T00:00:00Z')])

  expect(ordered.map((saved) => saved.id)).toEqual(['pm_a', 'pm_b'])
})

test('does not mutate what it was given', () => {
  const methods = [method('pm_a', '2025-01-01T00:00:00Z'), method('pm_b', '2026-01-01T00:00:00Z')]

  orderSavedMethods(methods)

  expect(methods.map((saved) => saved.id)).toEqual(['pm_a', 'pm_b'])
})
