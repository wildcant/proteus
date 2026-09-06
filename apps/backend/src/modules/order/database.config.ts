import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/modules/order/models/*.ts',
  out: './src/modules/order/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_order' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
