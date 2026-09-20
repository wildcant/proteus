import { env } from '@env'
import type { LoaderFunction } from '../../../core/utils/module.js'
import { Modules } from '../../../core/utils/modules-definition.js'

/**
 * Registers the declared feature catalogue as permission rows. A postLoader rather than a loader,
 * because the work is one call on the module's own service and that service exists only once
 * bootstrap has registered it in the shared container.
 *
 * Skipped on workerd, where the loader cannot write: the database lives in an `AsyncLocalStorage`
 * store that only `withConnection()` fills, and bootstrap runs in global scope, where the runtime
 * refuses socket I/O at all. `scripts/seed-permissions.ts` is the out-of-band counterpart, run
 * against the target database before a Workers deploy.
 */
export const seedPermissions: LoaderFunction = async ({ container }) => {
  if (env.RUNTIME === 'workerd') return

  const service = container.resolve(Modules.ACCESS_CONTROL)
  await service.syncPermissions()
}
