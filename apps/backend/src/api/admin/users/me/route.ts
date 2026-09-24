import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { PermissionKey } from '@core/types/access-control/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminMeResponse, AdminUpdateMe } from '@proteus/http-schemas/admin'
import { i18n } from '@proteus/utils'
import { adminLocales } from '@workflows/admin/utils/admin-locales.js'
import { buildSettingsSidebar, buildSidebar } from '@workflows/admin/utils/build-sidebar.js'

export const GetOutput = AdminMeResponse
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const actorId = req.authContext?.actorId
  if (!actorId) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: i18n.t('User ID not found') })
  }

  const userService = req.scope.resolve(Modules.USER)
  const accessControl = req.scope.resolve(Modules.ACCESS_CONTROL)

  const [user, allowedActions, roles, sellableMarkets] = await Promise.all([
    userService.retrieveUser(actorId),
    accessControl.resolveEffectiveFeatures('user', actorId),
    accessControl.listActorRoles('user', actorId),
    req.scope.resolve(Modules.REGION).listCountryMarkets({ onlySellable: true }),
  ])

  const actionSet = new Set<PermissionKey>(allowedActions)

  return {
    status: 200,
    json: {
      user: { ...user, roles: roles.map((r) => ({ id: r.id, name: r.name })) },
      locales: adminLocales(sellableMarkets),
      allowedActions,
      sidebar: buildSidebar(actionSet),
      settingsSidebar: buildSettingsSidebar(actionSet),
    },
  }
}

export const PatchInput = { body: AdminUpdateMe }
export const PatchOutput = AdminMeResponse
export const PatchThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.INVALID_DATA] as const

/** The signed-in staff member changes their own Locale. Only to one the picker offers. */
export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const actorId = req.authContext?.actorId
  if (!actorId) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: i18n.t('User ID not found') })
  }

  const sellableMarkets = await req.scope.resolve(Modules.REGION).listCountryMarkets({ onlySellable: true })
  const locales = adminLocales(sellableMarkets)
  if (!locales.includes(req.body.locale)) {
    throw new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: i18n.t('{locale} is not a language the admin offers'),
      values: { locale: req.body.locale },
    })
  }

  await req.scope.resolve(Modules.USER).updateUser(actorId, { locale: req.body.locale })
  return GET(req)
}
