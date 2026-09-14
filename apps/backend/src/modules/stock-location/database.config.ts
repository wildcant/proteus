import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/modules/stock-location/models/*.ts',
  out: './src/modules/stock-location/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_stock-location' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
