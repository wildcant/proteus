import type { AwilixContainer } from 'awilix'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  AuthVerificationService,
  ConfirmAuthVerificationDTO,
  ConfirmAuthVerificationResult,
  RequestAuthVerificationDTO,
  RequestAuthVerificationResult,
} from '../../../core/types/auth/verification.js'
import type { AbstractAuthVerificationProvider } from '../../../core/utils/abstract-auth-verification-provider.js'

type InjectedDependencies = {
  container: AwilixContainer
}

export class VerificationProviderService {
  private container: AwilixContainer

  constructor({ container }: InjectedDependencies) {
    this.container = container
  }

  retrieveProvider(providerId: string): AbstractAuthVerificationProvider {
    const key = `verif_${providerId}`
    try {
      return this.container.resolve<AbstractAuthVerificationProvider>(key)
    } catch {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `Verification provider "${providerId}" is not registered`,
      })
    }
  }

  async request(
    input: { providerId: string; data: RequestAuthVerificationDTO },
    authVerificationService: AuthVerificationService,
  ): Promise<RequestAuthVerificationResult> {
    return this.retrieveProvider(input.providerId).request(input.data, authVerificationService)
  }

  async confirm(
    input: { providerId: string; data: ConfirmAuthVerificationDTO },
    authVerificationService: AuthVerificationService,
  ): Promise<ConfirmAuthVerificationResult> {
    return this.retrieveProvider(input.providerId).confirm(input.data, authVerificationService)
  }
}
