import { createRequire } from 'node:module'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime } from '@temporalio/worker'
import { PAYLOAD_CONVERTER_PATH } from '../../src/core/temporal/config.js'

/**
 * What every test that boots a Temporal server of its own needs, for whichever subsystem is booting
 * it.
 *
 * It lives here rather than under either subsystem because two of them now boot servers — the
 * workflow engine and the event bus — and `check:structure` forbids them from reaching each other, so a
 * helper owned by one is a helper the other cannot have. The pieces below are Temporal's, not any
 * subsystem's: a process-global SDK Runtime and a `require` hook.
 *
 * Both installers are process-global rather than per-file, and vitest resets the module registry
 * between files while reusing the worker process — so a plain module-level flag would be reset while
 * the thing it guards would not. `globalThis` is what actually matches their lifetime.
 */

const RUNTIME_INSTALLED = Symbol.for('proteus.temporal.runtime-installed')
const TSX_REQUIRE_INSTALLED = Symbol.for('proteus.temporal.tsx-require-installed')

type GlobalFlags = Record<symbol, true | undefined>

/**
 * Booting an ephemeral server downloads its binary on first run, and building a workflow bundle is a
 * webpack pass, so the setup budget is minutes, not the default 5 seconds.
 */
export const TEMPORAL_BOOT_TIMEOUT = 180_000

/**
 * `Runtime.install()` throws if a Runtime already exists, and there is exactly one per process —
 * so the second Temporal test file to share a vitest worker would fail on setup rather than on
 * anything it asserts.
 *
 * The logger redirect is the reason to install a Runtime at all: `setup-test-env.ts` turns
 * `console.error`/`warn` into thrown errors, and the SDK logs at WARN while the test server
 * starts. Routing its output to `console.info` keeps it readable without failing a test for
 * something the SDK considers routine.
 */
export function installTemporalRuntime(): void {
  const flags = globalThis as unknown as GlobalFlags
  if (flags[RUNTIME_INSTALLED]) return
  flags[RUNTIME_INSTALLED] = true

  Runtime.install({
    logger: new DefaultLogger('WARN', ({ level, message }) => console.info(`[temporal] ${level} ${message}`)),
  })
}

/**
 * Temporal loads `payloadConverterPath` with `require()`, and this repo ships TypeScript sources
 * with no build step — `npm run worker` and `npm run dev` both go through tsx, which handles that.
 * Vitest does not: it leaves node_modules on plain Node, where requiring a `.ts` file fails on the
 * first `.js` specifier that has no `.js` on disk.
 *
 * Installing tsx's own require hook is the smallest fix that keeps the tests running the *same*
 * converter the Worker does, rather than a second copy wired up differently.
 */
export function installTypeScriptRequireHook(): void {
  const flags = globalThis as unknown as GlobalFlags
  if (flags[TSX_REQUIRE_INSTALLED]) return
  flags[TSX_REQUIRE_INSTALLED] = true

  const require = createRequire(import.meta.url)
  const tsx = require('tsx/cjs/api') as { register: () => unknown }
  tsx.register()
}

/**
 * A **full** Temporal server, run from the Temporal CLI binary, whose client speaks the same tagged
 * payload format as production.
 *
 * The time-skipping server (`createTemporalTestEnvironment`, next to the workflow engine) is a
 * separate Java implementation of the parts a workflow test needs; standalone activities are not
 * among them. This one is the real server, so `client.activity.start` behaves as it does in
 * production — which is the only place dedup, retry and priority can honestly be asserted.
 *
 * `activity.enableStandalone` is passed even though the CLI dev server already defaults it on:
 * `temporalio/server`, the image `docker-compose.yml` runs, does not, and answers
 * `Standalone activity is disabled` without it. Setting it here keeps the tested configuration and
 * the deployed one the same statement rather than two that happen to agree.
 */
export async function createTemporalDevServerEnvironment(): Promise<TestWorkflowEnvironment> {
  installTypeScriptRequireHook()
  installTemporalRuntime()

  return TestWorkflowEnvironment.createLocal({
    server: { extraArgs: ['--dynamic-config-value', 'activity.enableStandalone=true'] },
    client: { dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH } },
  })
}
