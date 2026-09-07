import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/modules/auth/models/*.ts',
  out: './src/modules/auth/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_auth' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
