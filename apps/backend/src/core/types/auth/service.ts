import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  AuthIdentityDTO,
  FilterableAuthIdentityProps,
  FilterableProviderIdentityProps,
  ProviderIdentityDTO,
} from './common.js'
import type {
  ConsumePasswordResetTokenDTO,
  CreateAuthIdentityDTO,
  CreateAuthPasswordResetTokenDTO,
  CreateAuthVerificationDTO,
  CreatePasswordResetTokenDTO,
  CreateProviderIdentityDTO,
  UpdateAuthIdentityDTO,
  UpdateAuthVerificationDTO,
  UpdateProviderIdentityDTO,
} from './mutations.js'
import type { AuthenticationInput, AuthenticationResponse } from './provider.js'
import type {
  AuthPasswordResetTokenDTO,
  AuthVerificationDTO,
  ConfirmAuthVerificationDTO,
  ConfirmAuthVerificationResult,
  ConsumePasswordResetTokenResult,
  CreatePasswordResetTokenResult,
  FilterableAuthVerificationProps,
  RequestAuthVerificationDTO,
  RequestAuthVerificationResult,
} from './verification.js'

export type IAuthModuleService = {
  // Auth provider delegation
  register(provider: string, authData: AuthenticationInput): Promise<AuthenticationResponse>
  authenticate(provider: string, authData: AuthenticationInput): Promise<AuthenticationResponse>
  updateProvider(provider: string, data: Record<string, unknown>): Promise<AuthenticationResponse>

  // Verification provider delegation
  requestAuthVerification(data: RequestAuthVerificationDTO, context?: Context): Promise<RequestAuthVerificationResult>
  confirmAuthVerification(data: ConfirmAuthVerificationDTO, context?: Context): Promise<ConfirmAuthVerificationResult>

  // Token refresh validation
  validateAuthIdentity(
    authIdentityId: string,
    provider: string,
  ): Promise<{ authIdentity: AuthIdentityDTO & { providerIdentities: ProviderIdentityDTO[] } }>

  // AuthIdentity
  retrieveAuthIdentity(id: string, config?: FindConfig<AuthIdentityDTO>, context?: Context): Promise<AuthIdentityDTO>
  listAuthIdentities(
    filters?: FilterableAuthIdentityProps,
    config?: FindConfig<AuthIdentityDTO>,
    context?: Context,
  ): Promise<AuthIdentityDTO[]>
  listAndCountAuthIdentities(
    filters?: FilterableAuthIdentityProps,
    config?: FindConfig<AuthIdentityDTO>,
    context?: Context,
  ): Promise<[AuthIdentityDTO[], number]>
  createAuthIdentities(data: CreateAuthIdentityDTO[], context?: Context): Promise<AuthIdentityDTO[]>
  updateAuthIdentities(ids: string[], data: UpdateAuthIdentityDTO, context?: Context): Promise<AuthIdentityDTO[]>
  createAuthIdentity(data: CreateAuthIdentityDTO, context?: Context): Promise<AuthIdentityDTO>
  updateAuthIdentity(id: string, data: UpdateAuthIdentityDTO, context?: Context): Promise<AuthIdentityDTO>
  softDeleteAuthIdentities(ids: string[], context?: Context): Promise<void>
  restoreAuthIdentities(ids: string[], context?: Context): Promise<void>

  // ProviderIdentity
  retrieveProviderIdentity(
    id: string,
    config?: FindConfig<ProviderIdentityDTO>,
    context?: Context,
  ): Promise<ProviderIdentityDTO>
  listProviderIdentities(
    filters?: FilterableProviderIdentityProps,
    config?: FindConfig<ProviderIdentityDTO>,
    context?: Context,
  ): Promise<ProviderIdentityDTO[]>
  listAndCountProviderIdentities(
    filters?: FilterableProviderIdentityProps,
    config?: FindConfig<ProviderIdentityDTO>,
    context?: Context,
  ): Promise<[ProviderIdentityDTO[], number]>
  createProviderIdentities(data: CreateProviderIdentityDTO[], context?: Context): Promise<ProviderIdentityDTO[]>
  updateProviderIdentities(
    ids: string[],
    data: UpdateProviderIdentityDTO,
    context?: Context,
  ): Promise<ProviderIdentityDTO[]>
  createProviderIdentity(data: CreateProviderIdentityDTO, context?: Context): Promise<ProviderIdentityDTO>
  updateProviderIdentity(id: string, data: UpdateProviderIdentityDTO, context?: Context): Promise<ProviderIdentityDTO>
  softDeleteProviderIdentities(ids: string[], context?: Context): Promise<void>
  restoreProviderIdentities(ids: string[], context?: Context): Promise<void>

  // AuthVerification
  retrieveAuthVerification(
    id: string,
    config?: FindConfig<AuthVerificationDTO>,
    context?: Context,
  ): Promise<AuthVerificationDTO>
  listAuthVerifications(
    filters?: FilterableAuthVerificationProps,
    config?: FindConfig<AuthVerificationDTO>,
    context?: Context,
  ): Promise<AuthVerificationDTO[]>
  listAndCountAuthVerifications(
    filters?: FilterableAuthVerificationProps,
    config?: FindConfig<AuthVerificationDTO>,
    context?: Context,
  ): Promise<[AuthVerificationDTO[], number]>
  createAuthVerifications(data: CreateAuthVerificationDTO[], context?: Context): Promise<AuthVerificationDTO[]>
  updateAuthVerifications(
    ids: string[],
    data: UpdateAuthVerificationDTO,
    context?: Context,
  ): Promise<AuthVerificationDTO[]>
  createAuthVerification(data: CreateAuthVerificationDTO, context?: Context): Promise<AuthVerificationDTO>
  updateAuthVerification(id: string, data: UpdateAuthVerificationDTO, context?: Context): Promise<AuthVerificationDTO>
  softDeleteAuthVerifications(ids: string[], context?: Context): Promise<void>
  restoreAuthVerifications(ids: string[], context?: Context): Promise<void>

  // Password reset (orchestration)
  createPasswordResetToken(input: CreatePasswordResetTokenDTO): Promise<CreatePasswordResetTokenResult>
  consumePasswordResetToken(input: ConsumePasswordResetTokenDTO): Promise<ConsumePasswordResetTokenResult>

  // AuthPasswordResetToken (hard-delete only)
  createAuthPasswordResetToken(
    data: CreateAuthPasswordResetTokenDTO,
    context?: Context,
  ): Promise<AuthPasswordResetTokenDTO>
  findAuthPasswordResetTokenByHash(tokenHash: string, context?: Context): Promise<AuthPasswordResetTokenDTO | null>
  deleteAuthPasswordResetTokensByProviderIdentity(providerIdentityId: string, context?: Context): Promise<void>
  deleteAuthPasswordResetToken(id: string, context?: Context): Promise<void>
}
