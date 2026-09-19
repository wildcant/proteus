import type { LoaderFunction } from '../../../core/utils/module.js'
import { Modules } from '../../../core/utils/modules-definition.js'
import type { AccessControlModuleService } from '../services/access-control-module-service.js'

export const syncPermissions: LoaderFunction = async ({ container }) => {
  const service = container.resolve<AccessControlModuleService>(Modules.ACCESS_CONTROL)
  await service.syncPermissions()
}
