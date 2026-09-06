import { env } from '@env'
import type { ActorType } from '@proteus/http-schemas/auth'
import type { StringValue } from 'ms'
import type { ConfigModule } from '../../config/types.js'
import type { AuthIdentityDTO, IAuthModuleService, ProviderIdentityDTO } from '../../types/index.js'
import { generateJwtToken } from './token.js'
import { validateVerification } from './validate-verification.js'

type AuthIdentityWithProviders = AuthIdentityDTO & {
  providerIdentities?: ProviderIdentityDTO[]
}

type GenerateTokenInput = {
  authIdentity: AuthIdentityWithProviders
  actorType: ActorType
  authProvider: string
}

export type AuthJwtConfig = {
  secret: string
  expiresIn: StringValue | number
}

export function getAuthJwtConfig(): AuthJwtConfig {
  return { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN as StringValue }
}

/**
 * Build a JWT from an auth identity. When `actorless` is true, `actorId` is
 * forced to empty string regardless of `app_metadata`. Used for registration
 * (always actorless) and token refresh when `actor_id` is already set
 * (just re-sign with fresh data).
 */
export function generateJwtTokenForAuthIdentity(
  { authIdentity, actorType, authProvider }: GenerateTokenInput,
  jwtConfig: AuthJwtConfig,
  options?: { actorless?: boolean },
): string {
  const providerIdentity = authIdentity.providerIdentities?.find((p) => p.provider === authProvider)
  const appMetadata = authIdentity.appMetadata ?? {}
  const actorIdKey = `${actorType}Id`
  const actorId = options?.actorless ? '' : ((appMetadata[actorIdKey] as string) ?? '')

  return generateJwtToken(
    {
      actorId,
      actorType,
      authIdentityId: authIdentity.id,
      authProvider,
      appMetadata,
      userMetadata: providerIdentity?.userMetadata ?? {},
    },
    jwtConfig,
  )
}

const RESET_PASSWORD_TOKEN_TTL_SECONDS = 15 * 60

/**
 * Build a purpose-bound reset JWT. The token carries `purpose: "reset"`,
 * a `jti` claim that links to the DB reset record, and the entity_id
 * in the `actorId` field so the update endpoint can identify the user.
 */
export function generateResetJwtToken(
  input: {
    entityId: string
    provider: string
    actorType: string
    authIdentityId: string
    jti: string
  },
  jwtConfig: AuthJwtConfig,
): string {
  return generateJwtToken(
    {
      actorId: input.entityId,
      actorType: input.actorType as GenerateTokenInput['actorType'],
      authIdentityId: input.authIdentityId,
      authProvider: input.provider,
      appMetadata: {},
      userMetadata: {},
      purpose: 'reset',
    },
    {
      secret: jwtConfig.secret,
      expiresIn: RESET_PASSWORD_TOKEN_TTL_SECONDS,
      jwtOptions: { jwtid: input.jti },
    },
  )
}

type GenerateTokenWithChecksResult = { token: string; verificationRequired?: true }

/**
 * Login/refresh token generation with verification gates.
 *
 * 1. Always generates an actorless token first
 * 2. Checks verification requirements via `validateVerification()`
 * 3. If verification is required, returns actorless token + flag
 * 4. Otherwise generates a full token with `actor_id` populated
 */
export async function generateJwtTokenWithChecks(
  authModuleService: IAuthModuleService,
  input: GenerateTokenInput,
  jwtConfig: AuthJwtConfig,
  verificationsConfig: ConfigModule['projectConfig']['http']['authVerificationsPerActor'],
): Promise<GenerateTokenWithChecksResult> {
  const verificationResult = await validateVerification(authModuleService, input, verificationsConfig)

  if (verificationResult.verificationRequired) {
    const actorlessToken = generateJwtTokenForAuthIdentity(input, jwtConfig, { actorless: true })
    return { token: actorlessToken, verificationRequired: true }
  }

  const fullToken = generateJwtTokenForAuthIdentity(input, jwtConfig)
  return { token: fullToken }
}
