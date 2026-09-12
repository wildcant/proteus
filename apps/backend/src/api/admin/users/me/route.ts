import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IUserModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminUserResponse } from '@proteus/http-schemas/admin'

export const GetOutput = AdminUserResponse
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const actorId = req.authContext?.actorId
  if (!actorId) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: 'User ID not found' })
  }

  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  const user = await userService.retrieveUser(actorId)
  return { status: 200, json: { user } }
}
