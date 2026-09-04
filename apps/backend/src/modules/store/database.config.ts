import { defineConfig } from 'drizzle-kit'
import { env } from '../../env.js'

export default defineConfig({
  schema: './src/modules/store/models/*.ts',
  out: './src/modules/store/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_store' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
