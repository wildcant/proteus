import { ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/auth/service.js'
import { Modules } from '@core/utils/index.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'

export type SetAuthAppMetadataInput = {
  authIdentityId: string
  actorType: string
  actorId: string | null
}

type StepOutput = {
  authIdentityId: string
  previousMetadata: Record<string, unknown> | null
}

export async function setAuthAppMetadataStep(ctx: WorkflowContext, input: SetAuthAppMetadataInput): Promise<void> {
  await ctx.step<StepOutput>(
    'set-auth-app-metadata',
    async ({ container }) => {
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
      const identity = await authService.retrieveAuthIdentity(input.authIdentityId)

      const key = `${input.actorType}Id`
      const previousMetadata = identity.appMetadata ? { ...identity.appMetadata } : null
      const currentValue = identity.appMetadata?.[key]

      if (currentValue != null && input.actorId !== null) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: `Auth identity "${input.authIdentityId}" already has "${key}" set`,
        })
      }

      const updatedMetadata = { ...(identity.appMetadata ?? {}), [key]: input.actorId }
      await authService.updateAuthIdentity(input.authIdentityId, { appMetadata: updatedMetadata })

      return { authIdentityId: input.authIdentityId, previousMetadata }
    },
    async ({ authIdentityId, previousMetadata }, { container }) => {
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
      await authService.updateAuthIdentity(authIdentityId, { appMetadata: previousMetadata })
    },
  )
}
