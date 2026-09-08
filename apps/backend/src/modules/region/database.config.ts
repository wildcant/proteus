import { defineConfig } from 'drizzle-kit'
import { env } from '../../env.js'

export default defineConfig({
  schema: './src/modules/region/models/*.ts',
  out: './src/modules/region/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_region' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
