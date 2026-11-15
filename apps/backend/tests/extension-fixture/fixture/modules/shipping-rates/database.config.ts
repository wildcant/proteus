import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './tests/extension-fixture/fixture/modules/shipping-rates/models/*.ts',
  out: './tests/extension-fixture/fixture/modules/shipping-rates/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_fixture_shipping_rates' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
