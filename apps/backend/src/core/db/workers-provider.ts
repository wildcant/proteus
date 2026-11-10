import { AsyncLocalStorage } from 'node:async_hooks'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Database } from '../../schema.type.js'
import { DB_OPTIONS } from './config.js'
import type { DbProvider } from './ports.js'

const als = new AsyncLocalStorage<Database>()

/**
 * `databaseUrl` is a function because Hyperdrive's connection string can only be read inside a
 * handler; workerd rejects reading it at module scope, where the provider is built.
 */
export function createWorkersDbProvider(databaseUrl: () => string): DbProvider {
  return {
    getDb: () => {
      const db = als.getStore()
      if (!db) throw new Error('Called outside withConnection() — no active request context')
      return db
    },

    async withConnection<T>(fn: () => Promise<T>): Promise<T> {
      // Prepared statements are what Hyperdrive caches per connection; it warns that `prepare: false`
      // can hang or fail intermittently behind its pool.
      const client = postgres(databaseUrl(), { prepare: true })
      const db = drizzle(client, DB_OPTIONS)
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
