import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { PermissionKey } from '@core/types/access-control/common.js'
import type { IUserModuleService } from '@core/types/user/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminMeResponse } from '@proteus/http-schemas/admin'
import type { AccessControlModuleService } from '../../../../modules/access-control/services/access-control-module-service.js'
import { buildSettingsSidebar, buildSidebar } from './sidebar.js'

export const GetOutput = AdminMeResponse
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const actorId = req.authContext?.actorId
  if (!actorId) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: 'User ID not found' })
  }

  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  const accessControl = req.scope.resolve<AccessControlModuleService>(Modules.ACCESS_CONTROL)

  const [user, allowedActions, roles] = await Promise.all([
    userService.retrieveUser(actorId),
    accessControl.resolveEffectiveFeatures('user', actorId),
    accessControl.listActorRoles('user', actorId),
  ])

  const actionSet = new Set<PermissionKey>(allowedActions)

  return {
    status: 200,
    json: {
      user: { ...user, roles: roles.map((r) => ({ id: r.id, name: r.name })) },
      allowedActions,
      sidebar: buildSidebar(actionSet),
      settingsSidebar: buildSettingsSidebar(actionSet),
    },
  }
}
