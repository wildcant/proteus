import { z } from 'zod'
import { appConfigInput } from './config.js'

const envSchema = z
  .object({
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
    // Signs every login token. An empty one makes tokens forgeable and a short one guessable, so the
    // backend refuses to start without 32 characters.
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('1d'),

    // Stripe. Read only when `stripe` is in `projectConfig.providers.payment` (src/config.ts), and then
    // the provider refuses to start without all three.
    STRIPE_SECRET_KEY: z.string().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().default(''),
    /**
     * Publishable, and therefore not a secret: it is served to every storefront through
     * `GET /store/carts/:id/payment-providers`. Required with Stripe on, because a checkout without
     * one boots a card form that cannot mount.
     */
    STRIPE_PUBLISHABLE_KEY: z.string().default(''),

    // Sendgrid
    // SENDGRID_API_KEY: z.string(),
    // SENDGRID_FROM: z.string(),

    // Resend. Read only when `resend` is in `projectConfig.providers.notification` (src/config.ts).
    RESEND_API_KEY: z.string().default(''),
    RESEND_FROM: z.string().default(''),

    // S3-compatible file storage. Production points at R2; `.env.local` points at the compose MinIO.
    S3_FILE_URL: z.string().default(''),
    S3_REGION: z.string().default(''),
    S3_BUCKET: z.string().default(''),
    S3_ACCESS_KEY_ID: z.string().default(''),
    S3_SECRET_ACCESS_KEY: z.string().default(''),
    S3_PREFIX: z.string().default(''),
    /** Required for Cloudflare R2 and other S3-compatible services; empty for AWS. */
    S3_ENDPOINT: z.string().default(''),
    /** MinIO addresses buckets by path rather than by subdomain. */
    S3_FORCE_PATH_STYLE: z.stringbool().default(false),

    /**
     * Temporal connection settings only. Which engine runs a workflow is not configured here:
     * `RUNTIME` decides it — `workerd` cannot load Temporal's native Worker and keeps the in-process
     * adapter, `node` gets Temporal — and a composition root can pin the other one through
     * `projectConfig.workflows.engine`. See `framework/workflows/engine-selection.ts`. Pointing at a
     * different cluster and choosing an engine stay separate knobs.
     */
    TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
    TEMPORAL_NAMESPACE: z.string().default('default'),

    /**
     * The queue this process publishes to, or polls.
     *
     * One name is the whole routing story in production, and the default is what every deployment
     * uses. It is a knob at all because a queue is *shared across environments*: a Temporal server
     * routes a task to whoever is polling, so a dev Worker on `.env.local` and an e2e backend on
     * `proteus_test_store` sharing one name means the dev Worker executes the e2e's checkout against
     * the dev database. Each e2e suite therefore names its own queue — see `defineE2eConfig`.
     *
     * The literal is duplicated in `framework/workflows/temporal/config.ts` rather than imported, because
     * `index.workerd.ts` reaches this file and the `no-temporal-in-workerd` rule stops it reaching
     * that one. Both sides say so.
     */
    TEMPORAL_TASK_QUEUE: z.string().default('proteus'),

    ADMIN_URL: z.url(),
    STORE_URL: z.url(),

    CORS_ORIGIN: z
      .string()
      .transform((s) => s.split(',').map((u) => u.trim()))
      .pipe(z.array(z.url()).min(1)),

    // ------------------------------ DEV ONLY ------------------------------

    MOCKS: z.coerce.boolean().default(false),

    /**
     * Opens a readiness endpoint on the Temporal Worker. Set by the e2e config, which has to wait
     * for the Worker before running a spec and can only do that by polling a URL. Unset everywhere
     * else, and the listener is not opened at all.
     */
    WORKER_HEALTH_PORT: z.coerce.number().int().positive().optional(),

    /**
     * Points the API at the toxiproxy in docker-compose.yml instead of Postgres directly, so every
     * query carries injected latency. Set by `pnpm dev:slow`; empty everywhere else. Ignored while
     * migrating — those run against DIRECT_DATABASE_URL and have no reason to be slow.
     */
    SLOW_DATABASE_URL: z.string().default(''),

    /**
     * Forces which file provider the file module registers, overriding the NODE_ENV default.
     * Set to `s3` to point a script or a local server at object storage.
     */
    FILE_PROVIDER: z.enum(['localfs', 's3']).optional(),
  })
  .superRefine((env, context) => {
    // The keys of each integration `src/config.ts` turns on, so a store that turns one on without its
    // keys fails here, naming the variable, rather than inside the provider at boot.
    const providers = appConfigInput.projectConfig?.providers
    const enabled = [...(providers?.payment ?? []), ...(providers?.notification ?? [])]
    for (const provider of enabled) {
      for (const key of PROVIDER_KEYS[provider]) {
        if (env[key]) continue
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `Required while "${provider}" is turned on in projectConfig.providers (src/config.ts)`,
        })
      }
    }
  })

/** The variables each optional integration reads. */
const PROVIDER_KEYS = {
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY'],
  resend: ['RESEND_API_KEY', 'RESEND_FROM'],
} as const

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
