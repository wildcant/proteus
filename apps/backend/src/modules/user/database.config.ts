import { env } from '@env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/modules/user/models/*.ts',
  out: './src/modules/user/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  migrations: { table: 'migrations_user' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
