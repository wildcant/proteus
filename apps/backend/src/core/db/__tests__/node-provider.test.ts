import { test } from '@tests/setup/test-extend.js'
import postgres from 'postgres'
import { describe, expect } from 'vitest'
import { env } from '../../../env.js'
import { createNodeDbProvider } from '../node-provider.js'

describe('createNodeDbProvider', () => {
  const client = postgres(env.DATABASE_URL, { prepare: false })
  const provider = createNodeDbProvider(client)

  test('getDb always returns the same instance', () => {
    const a = provider.getDb()
    const b = provider.getDb()
    expect(a).toBe(b)
  })

  test('withConnection is a passthrough', async () => {
    const result = await provider.withConnection(async () => 42)
    expect(result).toBe(42)
  })

  test('shutdown closes the postgres client', async () => {
    const dedicatedClient = postgres(env.DATABASE_URL, { prepare: false })
    const dedicatedProvider = createNodeDbProvider(dedicatedClient)

    await dedicatedProvider.shutdown()

    await expect(dedicatedClient`SELECT 1`).rejects.toThrow()
  })
})
