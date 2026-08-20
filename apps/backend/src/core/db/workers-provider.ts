import { AsyncLocalStorage } from 'node:async_hooks'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Database } from '../../schema.type.js'
import { DRIZZLE_OPTIONS } from './config.js'
import type { DbProvider } from './ports.js'

const als = new AsyncLocalStorage<Database>()

export function createWorkersDbProvider(databaseUrl: string): DbProvider {
  return {
    getDb: () => {
      const db = als.getStore()
      if (!db) throw new Error('Called outside withConnection() — no active request context')
      return db
    },

    async withConnection<T>(fn: () => Promise<T>): Promise<T> {
      const client = postgres(databaseUrl, { prepare: false })
      const db = drizzle(client, DRIZZLE_OPTIONS)
      try {
        return await als.run(db, fn)
      } finally {
        await client.end()
      }
    },

    shutdown: async () => {
      // noop
    },
  }
}
