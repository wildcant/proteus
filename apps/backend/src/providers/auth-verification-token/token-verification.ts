import {
  generateVerificationToken,
  getVerificationTokenTtlMs,
  hashVerificationToken,
} from '../../core/auth/utils/verification-token.js'
import { AppError } from '../../core/errors/app-error.js'
import type {
  AuthVerificationDTO,
  AuthVerificationService,
  ConfirmAuthVerificationDTO,
  ConfirmAuthVerificationResult,
  RequestAuthVerificationDTO,
  RequestAuthVerificationResult,
} from '../../core/types/auth/verification.js'
import { AbstractAuthVerificationProvider } from '../../core/utils/abstract-auth-verification-provider.js'

const DEFAULT_TTL_SECONDS = 900

type TokenVerificationConfig = {
  ttlSeconds?: number
}

export class TokenVerificationProvider extends AbstractAuthVerificationProvider<TokenVerificationConfig> {
  static identifier = 'token'

  private get ttlSeconds(): number {
    return this.config.ttlSeconds ?? DEFAULT_TTL_SECONDS
  }

  protected getTokenTtlMs(): number {
    return getVerificationTokenTtlMs(this.ttlSeconds)
  }

  async request(
    data: RequestAuthVerificationDTO,
    authVerificationService: AuthVerificationService,
  ): Promise<RequestAuthVerificationResult> {
    const existingVerifications = await authVerificationService.list({
      authIdentityId: data.authIdentityId,
      entityId: data.entityId,
      entityType: data.entityType,
    })

    const existing = existingVerifications[0]

    if (existing?.verifiedAt) {
      return existing
    }

    const token = generateVerificationToken()
    const tokenHash = hashVerificationToken(token)
    const requestedAt = new Date(Date.now())
    const expiresAt = new Date(requestedAt.getTime() + this.getTokenTtlMs())

    let verification: AuthVerificationDTO
    if (existing) {
      verification = await authVerificationService.update(existing.id, {
        codeProvider: data.codeProvider,
        providerMetadata: { tokenHash },
        requestedAt,
        verifiedAt: null,
      })
    } else {
      verification = await authVerificationService.create({
        authIdentityId: data.authIdentityId,
        entityId: data.entityId,
        entityType: data.entityType,
        codeProvider: data.codeProvider,
        providerMetadata: { tokenHash },
        requestedAt,
      })
    }

    return {
      ...verification,
      code: token,
      expiresAt,
    }
  }

  async confirm(
    data: ConfirmAuthVerificationDTO,
    authVerificationService: AuthVerificationService,
  ): Promise<ConfirmAuthVerificationResult> {
    if (!data.code) {
      throw new AppError({ type: AppError.Types.INVALID_DATA, message: 'Verification code is required' })
    }

    const verifications = await authVerificationService.list({
      providerMetadata: { $eq: { tokenHash: hashVerificationToken(data.code) } },
    })
    const verification = verifications[0]

    if (!verification || verification.verifiedAt) {
      throw new AppError({ type: AppError.Types.NOT_ALLOWED, message: 'Verification code is invalid or already used' })
    }

    if (data.codeProvider && data.codeProvider !== verification.codeProvider) {
      throw new AppError({
        type: AppError.Types.NOT_ALLOWED,
        message: `Verification code does not belong to provider "${data.codeProvider}"`,
      })
    }

    const expiresAt = new Date(verification.requestedAt).getTime() + this.getTokenTtlMs()

    if (expiresAt <= Date.now()) {
      throw new AppError({ type: AppError.Types.NOT_ALLOWED, message: 'Verification code has expired' })
    }

    return authVerificationService.update(verification.id, { verifiedAt: new Date(Date.now()) })
  }
}
