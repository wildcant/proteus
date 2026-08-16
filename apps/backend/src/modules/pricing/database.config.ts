import { defineConfig } from 'drizzle-kit'
import { env } from '../../env.js'

export default defineConfig({
  schema: './src/modules/pricing/models/*.ts',
  out: './src/modules/pricing/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_pricing' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
