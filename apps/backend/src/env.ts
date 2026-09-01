import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  RUNTIME: z.enum(['node', 'workerd']).default('node'),

  // Database
  POOLER_DATABASE_URL: z.string(),
  DIRECT_DATABASE_URL: z.string().default(''),
  MIGRATING: z.coerce.boolean().default(false),

  // Logger
  LOG_LEVEL: z.string().default('http'),
  LOG_FILE: z.string().default(''),

  // Auth
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1d'),

  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),

  // Sendgrid
  // SENDGRID_API_KEY: z.string(),
  // SENDGRID_FROM: z.string(),

  // Resend
  RESEND_API_KEY: z.string(),
  RESEND_FROM: z.string(),

  // S3-compatible file storage (production only — dev and test use the local filesystem provider).
  S3_FILE_URL: z.string().default(''),
  S3_REGION: z.string().default(''),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_PREFIX: z.string().default(''),
  /** Required for Cloudflare R2 and other S3-compatible services; empty for AWS. */
  S3_ENDPOINT: z.string().default(''),

  /**
   * Temporal connection settings only. Which engine runs a workflow is not configured here —
   * `RUNTIME` decides that (ADR-0009 follow-up), so pointing at a different cluster and switching
   * engines stay separate knobs.
   */
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),

  ADMIN_URL: z.url(),
  STORE_URL: z.url(),

  /**
   * Where the backend sends operator alerts — a rolled-back checkout, a confirmation email that
   * never went out. One address, because there are no roles to ask for yet.
   *
   * TODO(rbac): replace with the users holding the role that cares about failed checkouts. The
   * default matches the dev seed's admin, so a fresh environment works without editing `.env` —
   * which also means a deploy that never sets it alerts nobody.
   */
  ADMIN_NOTIFICATION_EMAIL: z.email().default('admin@example.com'),

  CORS_ORIGIN: z
    .string()
    .transform((s) => s.split(',').map((u) => u.trim()))
    .pipe(z.array(z.url()).min(1)),

  // ------------------------------ DEV ONLY ------------------------------

  MOCKS: z.coerce.boolean().default(false),

  /**
   * Points the API at the toxiproxy in docker-compose.yml instead of Postgres directly, so every
   * query carries injected latency. Set by `npm run dev:slow`; empty everywhere else. Ignored while
   * migrating — those run against DIRECT_DATABASE_URL and have no reason to be slow.
   */
  SLOW_DATABASE_URL: z.string().default(''),

  /**
   * Forces which file provider the file module registers, overriding the NODE_ENV default.
   * Set to `s3` to point a script or a local server at object storage.
   */
  FILE_PROVIDER: z.enum(['localfs', 's3']).optional(),
})

function resolveDatabaseUrl(env: z.infer<typeof envSchema>) {
  if (env.MIGRATING) return env.DIRECT_DATABASE_URL
  if (env.SLOW_DATABASE_URL) return env.SLOW_DATABASE_URL
  return env.POOLER_DATABASE_URL
}

function createEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }

  const env = {
    ...result.data,
    DATABASE_URL: resolveDatabaseUrl(result.data),
  }

  return env
}

export const env = createEnv()
