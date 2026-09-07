import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/link-modules/definitions/*.ts',
  out: './src/link-modules/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_links' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
