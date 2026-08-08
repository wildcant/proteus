import { z } from 'zod'

const envSchema = z.object({
  POOLER_DATABASE_URL: z.string(),
  DIRECT_DATABASE_URL: z.string().default(''),
  MIGRATING: z.coerce.boolean().default(false),
  RUNTIME: z.enum(['node', 'workerd']).default('node'),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('http'),
  LOG_FILE: z.string().default(''),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1d'),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),

  // Sendgrid
  // SENDGRID_API_KEY: z.string(),
  // SENDGRID_FROM: z.string(),

  // Resend (development only)
  RESEND_API_KEY: z.string(),
  RESEND_FROM: z.string(),

  ADMIN_URL: z.url(),

  CORS_ORIGIN: z
    .string()
    .transform((s) => s.split(',').map((u) => u.trim()))
    .pipe(z.array(z.url()).min(1)),
})

function createEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }

  const env = {
    ...result.data,
    DATABASE_URL: result.data.MIGRATING ? result.data.DIRECT_DATABASE_URL : result.data.POOLER_DATABASE_URL,
  }

  return env
}

export const env = createEnv()
