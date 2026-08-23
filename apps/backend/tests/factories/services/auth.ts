import type { AwilixContainer } from 'awilix'
import type {
  ConfirmAuthVerificationDTO,
  CreateAuthIdentityDTO,
  FilterableAuthVerificationProps,
  IAuthModuleService,
  RequestAuthVerificationDTO,
  UpdateAuthIdentityDTO,
  UpdateAuthVerificationDTO,
} from '../../../src/core/types/index.js'
import { Modules } from '../../../src/core/utils/index.js'
import {
  generateConfirmAuthVerificationDTO,
  generateCreateAuthIdentityDTO,
  generateRequestAuthVerificationDTO,
  generateUpdateAuthIdentityDTO,
  generateUpdateAuthVerificationDTO,
} from '../auth-dto.js'

export async function createAuthIdentity(container: AwilixContainer, overrides?: Partial<CreateAuthIdentityDTO>) {
  const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

  return authService.createAuthIdentity(generateCreateAuthIdentityDTO(overrides))
}

/**
 * Issues a verification and returns the provider's result, including the plaintext `code`
 * the confirm route never sends back.
 */
export async function requestAuthVerification(
  container: AwilixContainer,
  overrides?: Partial<RequestAuthVerificationDTO>,
) {
  const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

  return authService.requestAuthVerification(generateRequestAuthVerificationDTO(overrides))
}

export async function confirmAuthVerification(
  container: AwilixContainer,
  overrides?: Partial<ConfirmAuthVerificationDTO>,
) {
  const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

  return authService.confirmAuthVerification(generateConfirmAuthVerificationDTO(overrides))
}

// ---- Update ----

/** Stands in for the linking an invite or signup would do, by writing `appMetadata`. */
export async function updateAuthIdentity(
  container: AwilixContainer,
  authIdentityId: string,
  overrides?: Partial<UpdateAuthIdentityDTO>,
) {
  const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

  return authService.updateAuthIdentity(authIdentityId, generateUpdateAuthIdentityDTO(overrides))
}

export async function updateAuthVerification(
  container: AwilixContainer,
  verificationId: string,
  overrides?: Partial<UpdateAuthVerificationDTO>,
) {
  const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

  return authService.updateAuthVerification(verificationId, generateUpdateAuthVerificationDTO(overrides))
}

// ---- Reads ----

export async function retrieveAuthIdentity(container: AwilixContainer, authIdentityId: string) {
  const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

  return authService.retrieveAuthIdentity(authIdentityId)
}

export async function listAuthVerifications(container: AwilixContainer, filters?: FilterableAuthVerificationProps) {
  const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

  return authService.listAuthVerifications(filters)
}
