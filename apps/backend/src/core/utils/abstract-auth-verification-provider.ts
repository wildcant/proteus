import type {
  AuthVerificationService,
  ConfirmAuthVerificationDTO,
  ConfirmAuthVerificationResult,
  IAuthVerificationProvider,
  RequestAuthVerificationDTO,
  RequestAuthVerificationResult,
} from '../types/auth/verification.js'

/**
 * Abstract base class for auth verification providers.
 *
 * Subclasses must set a static `identifier` string and implement both
 * `request` and `confirm`. The provider's registration key in the
 * local container is `verif_{identifier}`.
 *
 * The constructor receives the module's local DI container and
 * provider-specific options. The CRUD service for verification records
 * is passed at call time (built by the module service with transaction
 * context baked in).
 *
 * @typeParam TConfig - Shape of the provider's options (e.g. `{ ttlSeconds: number }`).
 */
export abstract class AbstractAuthVerificationProvider<TConfig = Record<string, unknown>>
  implements IAuthVerificationProvider
{
  static identifier: string

  protected config: TConfig
  protected container: Record<string, unknown>

  constructor(container: Record<string, unknown>, config: TConfig) {
    this.container = container
    this.config = config
  }

  getIdentifier(): string {
    const ctr = this.constructor as typeof AbstractAuthVerificationProvider
    if (!ctr.identifier) {
      throw new Error('Missing static property "identifier".')
    }
    return ctr.identifier
  }

  abstract request(
    data: RequestAuthVerificationDTO,
    service: AuthVerificationService,
  ): Promise<RequestAuthVerificationResult>

  abstract confirm(
    data: ConfirmAuthVerificationDTO,
    service: AuthVerificationService,
  ): Promise<ConfirmAuthVerificationResult>
}
