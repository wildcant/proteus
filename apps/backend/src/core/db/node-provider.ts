import { drizzle } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import { DRIZZLE_OPTIONS } from './config.js'
import type { DbProvider } from './ports.js'

export function createNodeDbProvider(client: Sql): DbProvider {
  const db = drizzle(client, DRIZZLE_OPTIONS)

  return {
    getDb: () => db,
    withConnection: (fn) => fn(),
    shutdown: () => client.end(),
  }
}
