import { createRequire } from 'node:module'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime } from '@temporalio/worker'
import { PAYLOAD_CONVERTER_PATH } from '../../../../temporal/config.js'

/**
 * Shared setup for every test that boots a Temporal test server.
 *
 * Both pieces here are process-global rather than per-file, and vitest resets the module registry
 * between files while reusing the worker process — so a plain module-level flag would be reset
 * while the thing it guards would not. `globalThis` is what actually matches their lifetime.
 */

const RUNTIME_INSTALLED = Symbol.for('proteus.temporal.runtime-installed')
const TSX_REQUIRE_INSTALLED = Symbol.for('proteus.temporal.tsx-require-installed')

type GlobalFlags = Record<symbol, true | undefined>

/**
 * Booting the time-skipping test server downloads its binary on first run and building the
 * workflow bundle is a webpack pass, so the setup budget is minutes, not the default 5 seconds.
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
 * A time-skipping test server whose client speaks the same tagged payload format as production —
 * without it a `BigNumber` step output would come back as its `{s,e,c}` internals and every
 * assertion about money would be testing the wrong thing.
 */
export async function createTemporalTestEnvironment(): Promise<TestWorkflowEnvironment> {
  installTypeScriptRequireHook()
  installTemporalRuntime()

  return TestWorkflowEnvironment.createTimeSkipping({
    client: { dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH } },
  })
}
