import type { LoaderFunction } from '../../../core/utils/module.js'
import type { AccessControlModuleService } from '../services/access-control-module-service.js'

export const syncPermissions: LoaderFunction = async ({ container }) => {
  const service = container.resolve<AccessControlModuleService>('accessControlModuleService')
  await service.syncPermissions()
}
