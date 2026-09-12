import type { ActorType } from '@proteus/http-schemas/auth'
import { AppError, ErrorTypes } from '../../errors/app-error.js'
import type { AuthIdentityDTO, ProviderIdentityDTO } from '../../types/auth/common.js'
import type { IAuthModuleService } from '../../types/auth/service.js'
import type { ConfigModule } from '../../types/config.js'

type AuthIdentityWithProviders = AuthIdentityDTO & {
  providerIdentities?: ProviderIdentityDTO[]
}

type ValidateVerificationInput = {
  authIdentity: AuthIdentityWithProviders
  actorType: ActorType
  authProvider: string
}

type VerificationResult = { verificationRequired: false } | { verificationRequired: true }

/**
 * Checks whether the given actor type + provider combination requires
 * entity verification, and if so, whether the verification has been completed.
 *
 * Reads `authVerificationsPerActor` config, finds the matching provider identity,
 * and queries the `auth_verification` table.
 */
export async function validateVerification(
  authModuleService: IAuthModuleService,
  { authIdentity, actorType, authProvider }: ValidateVerificationInput,
  verificationsConfig: ConfigModule['projectConfig']['http']['authVerificationsPerActor'],
): Promise<VerificationResult> {
  const verificationConfig = verificationsConfig[actorType]
  if (!verificationConfig) return { verificationRequired: false }

  const matchingConfig = verificationConfig.find((entry) => entry.authProvider === authProvider)
  if (!matchingConfig) return { verificationRequired: false }

  const providerIdentity = authIdentity.providerIdentities?.find((p) => p.provider === authProvider)
  if (!providerIdentity) {
    throw new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: `Provider identity for "${authProvider}" not found on auth identity "${authIdentity.id}"`,
    })
  }

  const verifications = await authModuleService.listAuthVerifications({
    authIdentityId: authIdentity.id,
    entityId: providerIdentity.entityId,
    entityType: matchingConfig.entityType,
  })

  const verification = verifications[0]
  if (!verification?.verifiedAt) {
    return { verificationRequired: true }
  }

  return { verificationRequired: false }
}
