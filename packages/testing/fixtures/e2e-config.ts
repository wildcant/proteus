import { rmSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { DEFAULT_TEST_DATABASE_URL, withAppDatabase } from 'backend/test/database-url'
import { fakeGatewayStateDir } from 'backend/test/fake-gateway'

/**
 * The Playwright configuration both apps use, and the single place their ports and database name
 * are decided.
 *
 * It is a factory rather than two hand-written configs because the three per-app values have to
 * agree with each other: the suite's specs, the backend process they drive, and that process's fake
 * payment gateway must all land on the app's own database and its own listeners. A config that
 * names its port but inherits its database — which is what the two copies here did — runs green
 * against the wrong data.
 *
 * The port map:
 *
 * | 3010 | backend `dev:test`, hand-run | 3011 | store app                    |
 * | 3013 | store e2e backend            | 3012 | admin app                    |
 * | 3015 | admin e2e backend            | 3017 | store e2e worker readiness   |
 * |      |                              | 3018 | admin e2e worker readiness   |
 *
 * The e2e backends deliberately avoid 3010. `reuseExistingServer` cannot tell a backend started by
 * this config from one a developer left running by hand, and the two no longer point at the same
 * database — so the hand-run port is kept out of the set this reuses.
 */
export type E2eConfig = {
  /**
   * Names the suite's database (`proteus_test_<app>`) and is exported as `E2E_APP`, which is what
   * `withAppDatabase` reads in every process forked from this one. Use the workspace name.
   */
  app: string
  /** Where the app's own dev server listens — the `baseURL` specs navigate against. */
  appPort: number
  /** Where this suite's backend listens. Never 3010; see the note above `reuseExistingServer`. */
  backendPort: number
  /**
   * Where this suite's Temporal Worker answers "am I polling yet".
   *
   * It exists only because Playwright waits for a web server by polling a URL, and a Worker is not
   * one. See `WORKER_HEALTH_PORT`.
   */
  workerHealthPort: number
}

export function defineE2eConfig({ app, appPort, backendPort, workerHealthPort }: E2eConfig) {
  // Set on the main process, and so inherited by the workers and web servers forked from it. This
  // is what `withAppDatabase` reads, so putting it here rather than in the npm script means a bare
  // `npx playwright test` cannot reach the wrong database.
  //
  // Derived from POOLER_DATABASE_URL but never written back to it: the config is re-evaluated in
  // every worker, so a rewritten base would suffix itself once per process.
  process.env.E2E_APP = app

  // Overwrites whatever `.env.test` supplied, deliberately. A spec that reaches the backend
  // directly — to move a cart behind the page's back, say — must reach *this suite's* backend, and
  // the env file names the hand-run one on 3010. Two backends on two databases is precisely the
  // green-against-the-wrong-data failure this factory exists to prevent.
  process.env.VITE_BACKEND_URL = `http://localhost:${backendPort}`

  const database = withAppDatabase(process.env.POOLER_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL, app)

  /**
   * This suite's own Temporal queue.
   *
   * A queue is shared across environments, not scoped by one: a Temporal server hands a task to
   * whoever is polling, so a Worker started by `npm run worker:dev` on `.env.local` will happily
   * execute this suite's checkout against the *dev* database. That is not hypothetical — it is
   * what a whole run of red store specs turned out to be. Naming the queue per suite is what makes
   * the two invisible to each other, and the Worker below is the only thing polling this one.
   */
  const taskQueue = `proteus-e2e-${app}`

  /**
   * Where the fake Stripe keeps the cards it is holding.
   *
   * A file because the two processes below both fake the gateway: the API opens the payment
   * session, and the Worker authorizes it inside `complete-cart`. A wallet held in module state
   * would be attached in one process and listed from the other, so a card saved at checkout would
   * never reach the account page. There is one Stripe, so there is one file — and one per suite,
   * so the store and admin runs cannot see each other's.
   *
   * A directory of small files rather than one document: specs run `fullyParallel`, and a single
   * JSON file read-modified-written from both processes loses updates silently.
   *
   * Cleared on the way in rather than the way out: a leftover wallet from a previous run is the
   * kind of state that makes a suite pass for the wrong reason, and keeping it after a failure is
   * worth more than tidiness.
   */
  const gatewayState = fakeGatewayStateDir(app)
  rmSync(gatewayState, { force: true, recursive: true })

  return defineConfig({
    globalSetup: '@proteus/testing/global-setup',
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
      baseURL: `http://localhost:${appPort}`,
      trace: 'on-first-retry',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: [
      {
        // dotenvx leaves a variable alone when the environment already carries one, so these
        // override `.env.test` for this process without a second env file to keep in step.
        // `dev:test:e2e`, not `dev:test`: Playwright starts a web server before globalSetup, so the
        // suite's database has to be created and migrated by the server's own command.
        command: 'npm run --workspace=backend dev:test:e2e',
        url: `http://localhost:${backendPort}/health`,
        reuseExistingServer: true,
        env: {
          PORT: String(backendPort),
          POOLER_DATABASE_URL: database,
          DIRECT_DATABASE_URL: database,
          TEMPORAL_TASK_QUEUE: taskQueue,
          FAKE_GATEWAY_STATE: gatewayState,
        },
      },
      {
        // Where the checkout workflow actually runs. `reuseExistingServer` is off: a Worker left
        // over from a previous run holds this suite's queue but was started against whatever
        // database that run used, which is the exact failure the queue name exists to prevent.
        command: 'npm run --workspace=backend worker:test',
        url: `http://localhost:${workerHealthPort}`,
        reuseExistingServer: false,
        env: {
          WORKER_HEALTH_PORT: String(workerHealthPort),
          POOLER_DATABASE_URL: database,
          DIRECT_DATABASE_URL: database,
          TEMPORAL_TASK_QUEUE: taskQueue,
          FAKE_GATEWAY_STATE: gatewayState,
        },
      },
      {
        command: 'npm run dev:test',
        url: `http://localhost:${appPort}`,
        reuseExistingServer: true,
        // Vite's own env loading picks prefixed variables up from the process, which is how this
        // reaches `import.meta.env` in the browser and in the storefront's SSR pass.
        env: { VITE_BACKEND_URL: `http://localhost:${backendPort}` },
      },
    ],
  })
}
