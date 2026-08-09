import type { Database } from '../../schema.type.js'

export type DbProvider = {
  getDb(): Database
  withConnection<T>(fn: () => Promise<T>): Promise<T>
  shutdown(): Promise<void>
}
