import { test } from '@tests/setup/test-extend.js'
import { describe, expect } from 'vitest'
import { env } from '../../../env.js'
import { createWorkersDbProvider } from '../workers-provider.js'

describe('createWorkersDbProvider', () => {
  const provider = createWorkersDbProvider(env.DATABASE_URL)

  test('getDb throws outside withConnection', () => {
    expect(() => provider.getDb()).toThrow('Called outside withConnection()')
  })

  test('getDb returns a valid drizzle instance inside withConnection', async () => {
    await provider.withConnection(async () => {
      const db = provider.getDb()
      expect(db).toBeDefined()
      expect(typeof db.select).toBe('function')
    })
  })

  test('each withConnection call creates a fresh instance', async () => {
    let firstDb: unknown
    let secondDb: unknown

    await provider.withConnection(async () => {
      firstDb = provider.getDb()
    })
    await provider.withConnection(async () => {
      secondDb = provider.getDb()
    })

    expect(firstDb).not.toBe(secondDb)
  })

  test('shutdown is a no-op', async () => {
    await expect(provider.shutdown()).resolves.toBeUndefined()
  })
})
