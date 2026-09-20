import type {
  CreateAuthIdentityDTO,
  UpdateAuthIdentityDTO,
  UpdateAuthVerificationDTO,
} from '../../../src/core/types/auth/mutations.js'
import type {
  ConfirmAuthVerificationDTO,
  FilterableAuthVerificationProps,
  RequestAuthVerificationDTO,
} from '../../../src/core/types/auth/verification.js'
import type { AppContainer } from '../../../src/core/types/container.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import {
  generateConfirmAuthVerificationDTO,
  generateCreateAuthIdentityDTO,
  generateRequestAuthVerificationDTO,
  generateUpdateAuthIdentityDTO,
  generateUpdateAuthVerificationDTO,
} from '../auth-dto.js'

export async function createAuthIdentity(container: AppContainer, overrides?: Partial<CreateAuthIdentityDTO>) {
  const authService = container.resolve(Modules.AUTH)

  return authService.createAuthIdentity(generateCreateAuthIdentityDTO(overrides))
}

/**
 * Issues a verification and returns the provider's result, including the plaintext `code`
 * the confirm route never sends back.
 */
export async function requestAuthVerification(
  container: AppContainer,
  overrides?: Partial<RequestAuthVerificationDTO>,
) {
  const authService = container.resolve(Modules.AUTH)

  return authService.requestAuthVerification(generateRequestAuthVerificationDTO(overrides))
}

export async function confirmAuthVerification(
  container: AppContainer,
  overrides?: Partial<ConfirmAuthVerificationDTO>,
) {
  const authService = container.resolve(Modules.AUTH)

  return authService.confirmAuthVerification(generateConfirmAuthVerificationDTO(overrides))
}

// ---- Update ----

/** Stands in for the linking an invite or signup would do, by writing `appMetadata`. */
export async function updateAuthIdentity(
  container: AppContainer,
  authIdentityId: string,
  overrides?: Partial<UpdateAuthIdentityDTO>,
) {
  const authService = container.resolve(Modules.AUTH)

  return authService.updateAuthIdentity(authIdentityId, generateUpdateAuthIdentityDTO(overrides))
}

export async function updateAuthVerification(
  container: AppContainer,
  verificationId: string,
  overrides?: Partial<UpdateAuthVerificationDTO>,
) {
  const authService = container.resolve(Modules.AUTH)

  return authService.updateAuthVerification(verificationId, generateUpdateAuthVerificationDTO(overrides))
}

// ---- Reads ----

export async function retrieveAuthIdentity(container: AppContainer, authIdentityId: string) {
  const authService = container.resolve(Modules.AUTH)

  return authService.retrieveAuthIdentity(authIdentityId)
}

export async function listAuthVerifications(container: AppContainer, filters?: FilterableAuthVerificationProps) {
  const authService = container.resolve(Modules.AUTH)

  return authService.listAuthVerifications(filters)
}
