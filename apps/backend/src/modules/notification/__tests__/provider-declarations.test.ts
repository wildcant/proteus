import { describe, expect, test } from 'vitest'
import { notificationProviderDeclarations } from '../provider-declarations.js'

describe('notificationProviderDeclarations', () => {
  test('declares the in-app feed whatever the store turned on', () => {
    const declared = notificationProviderDeclarations({ payment: [], notification: [] }).providers ?? []
    expect(declared.map((provider) => provider.id)).toEqual(['default'])
  })
})
