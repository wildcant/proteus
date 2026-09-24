import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { PermissionKey } from '@core/types/access-control/common.js'
import type { Context } from '@core/types/context.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminMeResponse, AdminUpdateMe } from '@proteus/http-schemas/admin'
import { i18n } from '@proteus/utils'
import { buildSettingsSidebar, buildSidebar } from '@workflows/admin/utils/build-sidebar.js'

/** Offered even when no market sells in it: the admin's source language is always available. */
const SOURCE_LOCALE = 'en-US'

/**
 * The Locales a staff member can pick for the admin: every sellable market's, `en-US` first. The
 * admin loads its catalog from the language subtag, so `es-CO` and `es-MX` both render Spanish.
 */
async function listAdminLocales(regionService: IRegionModuleService, context?: Context): Promise<string[]> {
  const markets = await regionService.listCountryMarkets({ onlySellable: true }, context)
  const sold = markets.flatMap((market) => (market.localeCode ? [market.localeCode] : []))
  return [...new Set([SOURCE_LOCALE, ...sold])]
}

function requireActor(req: HttpRequest): string {
  const actorId = req.authContext?.actorId
  if (!actorId) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: i18n.t('User ID not found') })
  }
  return actorId
}

export const GetOutput = AdminMeResponse
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const actorId = requireActor(req)

  const userService = req.scope.resolve(Modules.USER)
  const accessControl = req.scope.resolve(Modules.ACCESS_CONTROL)

  const [user, allowedActions, roles, locales] = await Promise.all([
    userService.retrieveUser(actorId),
    accessControl.resolveEffectiveFeatures('user', actorId),
    accessControl.listActorRoles('user', actorId),
    listAdminLocales(req.scope.resolve(Modules.REGION)),
  ])

  const actionSet = new Set<PermissionKey>(allowedActions)

  return {
    status: 200,
    json: {
      user: { ...user, roles: roles.map((r) => ({ id: r.id, name: r.name })) },
      locales,
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
  const actorId = requireActor(req)

  const locales = await listAdminLocales(req.scope.resolve(Modules.REGION))
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
