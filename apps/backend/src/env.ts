import { z } from 'zod'

const envSchema = z.object({
  POOLER_DATABASE_URL: z.string(),
  DIRECT_DATABASE_URL: z.string().default(''),
  MIGRATING: z.coerce.boolean().default(false),
  RUNTIME: z.enum(['node', 'workerd']).default('node'),
  MOCKS: z.coerce.boolean().default(false),
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

  /**
   * Forces which file provider the file module registers, overriding the NODE_ENV default.
   * Set to `s3` to point a script or a local server at object storage.
   */
  FILE_PROVIDER: z.enum(['localfs', 's3']).optional(),

  // S3-compatible file storage (production only — dev and test use the local filesystem
  // provider). The s3 provider validates these at bootstrap and names any that are missing.
  S3_FILE_URL: z.string().default(''),
  S3_REGION: z.string().default(''),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_PREFIX: z.string().default(''),
  /** Required for Cloudflare R2 and other S3-compatible services; empty for AWS. */
  S3_ENDPOINT: z.string().default(''),

  ADMIN_URL: z.url(),
  STORE_URL: z.url(),

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
