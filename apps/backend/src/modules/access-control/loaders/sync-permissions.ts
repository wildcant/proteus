import type { LoaderFunction } from '../../../core/utils/module.js'
import { Modules } from '../../../core/utils/modules-definition.js'

export const syncPermissions: LoaderFunction = async ({ container }) => {
  const service = container.resolve(Modules.ACCESS_CONTROL)
  await service.syncPermissions()
}
