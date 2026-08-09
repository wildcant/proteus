import { defineConfig } from 'drizzle-kit'
import { env } from '../../env.js'

export default defineConfig({
  schema: './src/modules/notification/models/*.ts',
  out: './src/modules/notification/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_notification' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
