import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/modules/payment/models/*.ts',
  out: './src/modules/payment/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_payment' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
