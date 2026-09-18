import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/modules/access-control/models/*.ts',
  out: './src/modules/access-control/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_access_control' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
