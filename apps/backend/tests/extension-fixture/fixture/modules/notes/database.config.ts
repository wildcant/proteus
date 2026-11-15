import { defineConfig } from 'drizzle-kit'
import { env } from '../../../../../src/env.js'

export default defineConfig({
  schema: './tests/extension-fixture/fixture/modules/notes/models/*.ts',
  out: './tests/extension-fixture/fixture/modules/notes/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_fixture_notes' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
