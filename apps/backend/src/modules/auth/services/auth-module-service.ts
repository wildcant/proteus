import crypto from 'node:crypto'
import { AppError, ErrorTypes } from '../../../core/errors/index.js'
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityDTO,
  AuthIdentityProviderService,
  AuthPasswordResetTokenDTO,
  AuthVerificationDTO,
  AuthVerificationService,
  ConfirmAuthVerificationDTO,
  ConfirmAuthVerificationResult,
  ConsumePasswordResetTokenDTO,
  ConsumePasswordResetTokenResult,
  Context,
  CreateAuthIdentityDTO,
  CreateAuthPasswordResetTokenDTO,
  CreateAuthVerificationDTO,
  CreatePasswordResetTokenDTO,
  CreatePasswordResetTokenResult,
  CreateProviderIdentityDTO,
  FilterableAuthIdentityProps,
  FilterableAuthVerificationProps,
  FilterableProviderIdentityProps,
  FindConfig,
  IAuthModuleService,
  ProviderIdentityDTO,
  RequestAuthVerificationDTO,
  RequestAuthVerificationResult,
  UpdateAuthIdentityDTO,
  UpdateAuthVerificationDTO,
  UpdateProviderIdentityDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { AuthIdentityRepository } from '../repositories/auth-identity.js'
import type { AuthPasswordResetTokenRepository } from '../repositories/auth-password-reset-token.js'
import type { AuthVerificationRepository } from '../repositories/auth-verification.js'
import type { ProviderIdentityRepository } from '../repositories/provider-identity.js'
import type { AuthProviderService } from './auth-provider-service.js'
import type { VerificationProviderService } from './verification-provider-service.js'

const RESET_PASSWORD_TOKEN_TTL_SECONDS = 15 * 60

type InjectedDependencies = {
  authIdentityRepository: AuthIdentityRepository
  providerIdentityRepository: ProviderIdentityRepository
  authVerificationRepository: AuthVerificationRepository
  authPasswordResetTokenRepository: AuthPasswordResetTokenRepository
  authProviderService: AuthProviderService
  verificationProviderService: VerificationProviderService
  withTransaction: WithTransaction
  logger: Logger
}

export class AuthModuleService implements IAuthModuleService {
  private authIdentityRepository: AuthIdentityRepository
  private providerIdentityRepository: ProviderIdentityRepository
  private authVerificationRepository: AuthVerificationRepository
  private authPasswordResetTokenRepository: AuthPasswordResetTokenRepository
  private authProviderService: AuthProviderService
  private verificationProviderService: VerificationProviderService
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({
    authIdentityRepository,
    providerIdentityRepository,
    authVerificationRepository,
    authPasswordResetTokenRepository,
    authProviderService,
    verificationProviderService,
    withTransaction,
    logger,
  }: InjectedDependencies) {
    this.authIdentityRepository = authIdentityRepository
    this.providerIdentityRepository = providerIdentityRepository
    this.authVerificationRepository = authVerificationRepository
    this.authPasswordResetTokenRepository = authPasswordResetTokenRepository
    this.authProviderService = authProviderService
    this.verificationProviderService = verificationProviderService
    this.withTransaction = withTransaction
    this.logger = logger
  }

  async register(provider: string, authData: AuthenticationInput): Promise<AuthenticationResponse> {
    return this.authProviderService.register(provider, authData, this.getAuthIdentityProviderService(provider))
  }

  async authenticate(provider: string, authData: AuthenticationInput): Promise<AuthenticationResponse> {
    return this.authProviderService.authenticate(provider, authData, this.getAuthIdentityProviderService(provider))
  }

  async updateProvider(provider: string, data: Record<string, unknown>): Promise<AuthenticationResponse> {
    return this.authProviderService.update(provider, data, this.getAuthIdentityProviderService(provider))
  }

  async validateAuthIdentity(
    authIdentityId: string,
    provider: string,
  ): Promise<{ authIdentity: AuthIdentityDTO & { providerIdentities: ProviderIdentityDTO[] } }> {
    const authIdentity = await this.authIdentityRepository.findByIdOrFail(authIdentityId)
    const providerIdentities = await this.providerIdentityRepository.find({ authIdentityId: authIdentity.id, provider })

    if (providerIdentities.length === 0) {
      throw new AppError({ type: ErrorTypes.NOT_FOUND, message: 'Provider identity not found' })
    }

    return { authIdentity: { ...authIdentity, providerIdentities } }
  }

  /**
   * Build a scoped service that auth providers use to read/write identities.
   * This keeps providers decoupled from repositories — they only see
   * retrieve/create/update, scoped to a single provider string.
   */
  getAuthIdentityProviderService(provider: string, context?: Context): AuthIdentityProviderService {
    return {
      retrieve: async ({ entityId }) => {
        const results = await this.providerIdentityRepository.find({ entityId, provider }, { limit: 1 })
        const providerIdentity = results[0]
        if (!providerIdentity) return null

        const authIdentity = await this.authIdentityRepository.findByIdOrFail(providerIdentity.authIdentityId)
        return { authIdentity, providerIdentity }
      },

      create: async ({ entityId, providerMetadata, appMetadata }) => {
        return this.withTransaction(context, async (ctx) => {
          const authIdentity = await this.authIdentityRepository.create({ appMetadata: appMetadata ?? null }, ctx)
          const providerIdentity = await this.providerIdentityRepository.create(
            { authIdentityId: authIdentity.id, entityId, provider, providerMetadata: providerMetadata ?? null },
            ctx,
          )
          return { authIdentity, providerIdentity }
        })
      },

      update: async (entityId, data) => {
        return this.withTransaction(context, async (ctx) => {
          const results = await this.providerIdentityRepository.find({ entityId, provider }, { limit: 1 }, ctx)
          const existing = results[0]
          if (!existing) {
            throw new AppError({ type: ErrorTypes.NOT_FOUND, message: 'Provider identity not found' })
          }

          const providerIdentity = await this.providerIdentityRepository.update(
            existing.id,
            { providerMetadata: data.providerMetadata },
            ctx,
          )

          let authIdentity: AuthIdentityDTO
          if (data.appMetadata !== undefined) {
            authIdentity = await this.authIdentityRepository.update(
              existing.authIdentityId,
              { appMetadata: data.appMetadata },
              ctx,
            )
          } else {
            authIdentity = await this.authIdentityRepository.findByIdOrFail(existing.authIdentityId, undefined, ctx)
          }

          return { authIdentity, providerIdentity }
        })
      },
    }
  }

  getAuthVerificationService(context?: Context): AuthVerificationService {
    return {
      list: (filters) => this.authVerificationRepository.find(filters, undefined, context),
      create: (data) => this.authVerificationRepository.create(data, context),
      createMany: (data) => this.authVerificationRepository.createMany(data, context),
      update: (id, data) => this.authVerificationRepository.update(id, data, context),
      updateMany: (ids, data) => this.authVerificationRepository.updateMany(ids, data, context),
    }
  }

  // --- Verification ---

  async requestAuthVerification(
    data: RequestAuthVerificationDTO,
    context?: Context,
  ): Promise<RequestAuthVerificationResult> {
    return this.withTransaction(context, async (transactionContext) => {
      return this.verificationProviderService.request(
        { providerId: data.codeProvider, data },
        this.getAuthVerificationService(transactionContext),
      )
    })
  }

  async confirmAuthVerification(
    data: ConfirmAuthVerificationDTO,
    context?: Context,
  ): Promise<ConfirmAuthVerificationResult> {
    return this.withTransaction(context, async (transactionContext) => {
      return this.verificationProviderService.confirm(
        { providerId: data.codeProvider ?? 'token', data },
        this.getAuthVerificationService(transactionContext),
      )
    })
  }

  // --- Password Reset (orchestration) ---

  private hashJti(jti: string): string {
    return crypto.createHash('sha256').update(jti).digest('hex')
  }

  async createPasswordResetToken(input: CreatePasswordResetTokenDTO): Promise<CreatePasswordResetTokenResult> {
    const { provider, entityId, ttlSeconds = RESET_PASSWORD_TOKEN_TTL_SECONDS } = input

    const providerIdentities = await this.providerIdentityRepository.find({ entityId, provider }, { limit: 1 })
    const providerIdentity = providerIdentities[0]
    if (!providerIdentity) {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `Provider identity with entityId "${entityId}" and provider "${provider}" not found`,
      })
    }

    const jti = crypto.randomUUID()
    const tokenHash = this.hashJti(jti)
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

    await this.withTransaction(undefined, async (context) => {
      // Invalidate prior tokens for this provider identity
      await this.authPasswordResetTokenRepository.deleteByProviderIdentityId(providerIdentity.id, context)

      await this.authPasswordResetTokenRepository.create(
        {
          authIdentityId: providerIdentity.authIdentityId,
          providerIdentityId: providerIdentity.id,
          entityId,
          tokenHash,
          expiresAt,
        },
        context,
      )
    })

    return { jti, expiresAt, providerIdentity }
  }

  async consumePasswordResetToken(input: ConsumePasswordResetTokenDTO): Promise<ConsumePasswordResetTokenResult> {
    const { jti, provider, entityId } = input
    const tokenHash = this.hashJti(jti)

    const record = await this.authPasswordResetTokenRepository.findByTokenHash(tokenHash)
    if (!record) {
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Invalid or expired reset token' })
    }

    if (record.expiresAt < new Date()) {
      // Clean up expired token before rejecting
      await this.authPasswordResetTokenRepository.delete([record.id])
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Invalid or expired reset token' })
    }

    // Cross-check provider + entity_id against the DB record
    const providerIdentity = await this.providerIdentityRepository.findByIdOrFail(record.providerIdentityId)
    if (providerIdentity.provider !== provider || providerIdentity.entityId !== entityId) {
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Invalid or expired reset token' })
    }

    // Single-use: hard-delete the token atomically
    await this.authPasswordResetTokenRepository.delete([record.id])

    return {
      authIdentityId: record.authIdentityId,
      providerIdentityId: record.providerIdentityId,
      entityId: providerIdentity.entityId,
    }
  }

  // --- AuthIdentity ---

  async retrieveAuthIdentity(
    id: string,
    config?: FindConfig<AuthIdentityDTO>,
    context?: Context,
  ): Promise<AuthIdentityDTO> {
    return this.authIdentityRepository.findByIdOrFail(id, config, context)
  }

  async listAuthIdentities(
    filters?: FilterableAuthIdentityProps,
    config?: FindConfig<AuthIdentityDTO>,
    context?: Context,
  ): Promise<AuthIdentityDTO[]> {
    return this.authIdentityRepository.find(filters, config, context)
  }

  async listAndCountAuthIdentities(
    filters?: FilterableAuthIdentityProps,
    config?: FindConfig<AuthIdentityDTO>,
    context?: Context,
  ): Promise<[AuthIdentityDTO[], number]> {
    return this.authIdentityRepository.findAndCount(filters, config, context)
  }

  async createAuthIdentities(data: CreateAuthIdentityDTO[], context?: Context): Promise<AuthIdentityDTO[]> {
    this.logger.debug(`Creating ${data.length} auth identity(ies)`)
    return this.withTransaction(context, async (ctx) => {
      return this.authIdentityRepository.createMany(data, ctx)
    })
  }

  async updateAuthIdentities(
    ids: string[],
    data: UpdateAuthIdentityDTO,
    context?: Context,
  ): Promise<AuthIdentityDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.authIdentityRepository.updateMany(ids, data, ctx)
    })
  }

  async createAuthIdentity(data: CreateAuthIdentityDTO, context?: Context): Promise<AuthIdentityDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.authIdentityRepository.create(data, ctx)
    })
  }

  async updateAuthIdentity(id: string, data: UpdateAuthIdentityDTO, context?: Context): Promise<AuthIdentityDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.authIdentityRepository.update(id, data, ctx)
    })
  }

  async softDeleteAuthIdentities(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.authIdentityRepository.softDelete(ids, ctx)
    })
  }

  async restoreAuthIdentities(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.authIdentityRepository.restore(ids, ctx)
    })
  }

  // --- ProviderIdentity ---

  async retrieveProviderIdentity(
    id: string,
    config?: FindConfig<ProviderIdentityDTO>,
    context?: Context,
  ): Promise<ProviderIdentityDTO> {
    return this.providerIdentityRepository.findByIdOrFail(id, config, context)
  }

  async listProviderIdentities(
    filters?: FilterableProviderIdentityProps,
    config?: FindConfig<ProviderIdentityDTO>,
    context?: Context,
  ): Promise<ProviderIdentityDTO[]> {
    return this.providerIdentityRepository.find(filters, config, context)
  }

  async listAndCountProviderIdentities(
    filters?: FilterableProviderIdentityProps,
    config?: FindConfig<ProviderIdentityDTO>,
    context?: Context,
  ): Promise<[ProviderIdentityDTO[], number]> {
    return this.providerIdentityRepository.findAndCount(filters, config, context)
  }

  async createProviderIdentities(data: CreateProviderIdentityDTO[], context?: Context): Promise<ProviderIdentityDTO[]> {
    this.logger.debug(`Creating ${data.length} provider identity(ies)`)
    return this.withTransaction(context, async (ctx) => {
      return this.providerIdentityRepository.createMany(data, ctx)
    })
  }

  async updateProviderIdentities(
    ids: string[],
    data: UpdateProviderIdentityDTO,
    context?: Context,
  ): Promise<ProviderIdentityDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.providerIdentityRepository.updateMany(ids, data, ctx)
    })
  }

  async createProviderIdentity(data: CreateProviderIdentityDTO, context?: Context): Promise<ProviderIdentityDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.providerIdentityRepository.create(data, ctx)
    })
  }

  async updateProviderIdentity(
    id: string,
    data: UpdateProviderIdentityDTO,
    context?: Context,
  ): Promise<ProviderIdentityDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.providerIdentityRepository.update(id, data, ctx)
    })
  }

  async softDeleteProviderIdentities(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.providerIdentityRepository.softDelete(ids, ctx)
    })
  }

  async restoreProviderIdentities(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.providerIdentityRepository.restore(ids, ctx)
    })
  }

  // --- AuthVerification ---

  async retrieveAuthVerification(
    id: string,
    config?: FindConfig<AuthVerificationDTO>,
    context?: Context,
  ): Promise<AuthVerificationDTO> {
    return this.authVerificationRepository.findByIdOrFail(id, config, context)
  }

  async listAuthVerifications(
    filters?: FilterableAuthVerificationProps,
    config?: FindConfig<AuthVerificationDTO>,
    context?: Context,
  ): Promise<AuthVerificationDTO[]> {
    return this.authVerificationRepository.find(filters, config, context)
  }

  async listAndCountAuthVerifications(
    filters?: FilterableAuthVerificationProps,
    config?: FindConfig<AuthVerificationDTO>,
    context?: Context,
  ): Promise<[AuthVerificationDTO[], number]> {
    return this.authVerificationRepository.findAndCount(filters, config, context)
  }

  async createAuthVerifications(data: CreateAuthVerificationDTO[], context?: Context): Promise<AuthVerificationDTO[]> {
    this.logger.debug(`Creating ${data.length} auth verification(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.authVerificationRepository.createMany(data, ctx)
    })
  }

  async updateAuthVerifications(
    ids: string[],
    data: UpdateAuthVerificationDTO,
    context?: Context,
  ): Promise<AuthVerificationDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.authVerificationRepository.updateMany(ids, data, ctx)
    })
  }

  async createAuthVerification(data: CreateAuthVerificationDTO, context?: Context): Promise<AuthVerificationDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.authVerificationRepository.create(data, ctx)
    })
  }

  async updateAuthVerification(
    id: string,
    data: UpdateAuthVerificationDTO,
    context?: Context,
  ): Promise<AuthVerificationDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.authVerificationRepository.update(id, data, ctx)
    })
  }

  async softDeleteAuthVerifications(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.authVerificationRepository.softDelete(ids, ctx)
    })
  }

  async restoreAuthVerifications(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.authVerificationRepository.restore(ids, ctx)
    })
  }

  // --- AuthPasswordResetToken (hard-delete only) ---

  async createAuthPasswordResetToken(
    data: CreateAuthPasswordResetTokenDTO,
    context?: Context,
  ): Promise<AuthPasswordResetTokenDTO> {
    this.logger.debug('Creating auth password reset token')
    return this.withTransaction(context, async (ctx) => {
      return this.authPasswordResetTokenRepository.create(data, ctx)
    })
  }

  async findAuthPasswordResetTokenByHash(
    tokenHash: string,
    context?: Context,
  ): Promise<AuthPasswordResetTokenDTO | null> {
    return this.authPasswordResetTokenRepository.findByTokenHash(tokenHash, context)
  }

  async deleteAuthPasswordResetTokensByProviderIdentity(providerIdentityId: string, context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.authPasswordResetTokenRepository.deleteByProviderIdentityId(providerIdentityId, ctx)
    })
  }

  async deleteAuthPasswordResetToken(id: string, context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.authPasswordResetTokenRepository.delete([id], ctx)
    })
  }
}
