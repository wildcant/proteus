import type { AwilixContainer } from 'awilix'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type { Logger } from '../../../core/types/logger.js'
import type {
  FilterablePaymentProviderProps,
  PaymentProviderDTO,
  PaymentProviderMeta,
} from '../../../core/types/payment/common.js'
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  CreatePaymentProviderDTO,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentMethodInput,
  DeletePaymentMethodOutput,
  DeletePaymentOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ListPaymentMethodsInput,
  ListPaymentMethodsOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  SavePaymentMethodInput,
  SavePaymentMethodOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '../../../core/types/payment/mutations.js'
import type { IPaymentProvider } from '../../../core/types/payment/provider.js'
import type { AbstractPaymentProvider } from '../../../core/utils/abstract-payment-provider.js'
import type { PaymentProviderRepository } from '../repositories/payment-provider.js'

type InjectedDependencies = {
  container: AwilixContainer
  paymentProviderRepository: PaymentProviderRepository
  logger: Logger
}

export class PaymentProviderService {
  private container: AwilixContainer
  private paymentProviderRepository: PaymentProviderRepository
  private logger: Logger

  constructor({ container, paymentProviderRepository, logger }: InjectedDependencies) {
    this.container = container
    this.paymentProviderRepository = paymentProviderRepository
    this.logger = logger
  }

  retrieveProvider(providerId: string): IPaymentProvider {
    try {
      return this.container.resolve<IPaymentProvider>(providerId)
    } catch {
      throw new AppError({ type: ErrorTypes.NOT_FOUND, message: `Payment provider "${providerId}" is not registered.` })
    }
  }

  getProviderMeta(providerId: string): PaymentProviderMeta {
    const provider = this.retrieveProvider(providerId)
    const klass = provider.constructor as typeof AbstractPaymentProvider
    // `?? {}` rather than a stub on every provider: a gateway with nothing publishable publishes
    // nothing, exactly as the optional saved-method operations work.
    return { label: klass.label, isTestOnly: klass.isTestOnly, publicConfig: provider.getPublicConfig?.() ?? {} }
  }

  // -- Provider table CRUD --

  async list(
    filters?: FilterablePaymentProviderProps,
    config?: FindConfig<PaymentProviderDTO>,
    context?: Context,
  ): Promise<PaymentProviderDTO[]> {
    return this.paymentProviderRepository.find(filters, config, context)
  }

  async upsert(providers: CreatePaymentProviderDTO[], context?: Context): Promise<void> {
    await Promise.all(
      providers.map(async (provider) => {
        const existing = await this.paymentProviderRepository.findById(provider.id, undefined, context)
        if (existing) {
          this.logger.debug(`Updating payment provider "${provider.id}"`)
          await this.paymentProviderRepository.update(provider.id, { isEnabled: provider.isEnabled ?? true }, context)
        } else {
          this.logger.debug(`Registering new payment provider "${provider.id}"`)
          await this.paymentProviderRepository.create(provider, context)
        }
      }),
    )
  }

  // -- Delegate to provider instances --

  async createSession(providerId: string, input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    this.logger.debug(`Creating session via provider "${providerId}" for ${input.amount} ${input.currencyCode}`)
    const provider = this.retrieveProvider(providerId)
    return provider.initiatePayment(input)
  }

  /**
   * Reachable at last. The provider's update method had no delegate, so a cart total that changed
   * after the session was opened could never reach the gateway.
   */
  async updateSession(providerId: string, input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    this.logger.debug(`Updating session via provider "${providerId}" to ${input.amount} ${input.currencyCode}`)
    const provider = this.retrieveProvider(providerId)
    return provider.updatePayment(input)
  }

  async deleteSession(providerId: string, input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    this.logger.debug(`Deleting session via provider "${providerId}"`)
    const provider = this.retrieveProvider(providerId)
    return provider.deletePayment(input)
  }

  async authorizePayment(providerId: string, input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    this.logger.debug(`Authorizing payment via provider "${providerId}"`)
    const provider = this.retrieveProvider(providerId)
    return provider.authorizePayment(input)
  }

  async capturePayment(providerId: string, input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    this.logger.debug(`Capturing payment via provider "${providerId}"`)
    const provider = this.retrieveProvider(providerId)
    return provider.capturePayment(input)
  }

  async cancelPayment(providerId: string, input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    this.logger.debug(`Canceling payment via provider "${providerId}"`)
    const provider = this.retrieveProvider(providerId)
    return provider.cancelPayment(input)
  }

  async refundPayment(providerId: string, input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    this.logger.debug(`Refunding payment via provider "${providerId}" for amount ${input.amount}`)
    const provider = this.retrieveProvider(providerId)
    return provider.refundPayment(input)
  }

  async createAccountHolder(
    providerId: string,
    input: CreateAccountHolderInput,
  ): Promise<CreateAccountHolderOutput | undefined> {
    const provider = this.retrieveProvider(providerId)
    if (!provider.createAccountHolder) return undefined
    return provider.createAccountHolder(input)
  }

  async deleteAccountHolder(
    providerId: string,
    input: DeleteAccountHolderInput,
  ): Promise<DeleteAccountHolderOutput | undefined> {
    const provider = this.retrieveProvider(providerId)
    if (!provider.deleteAccountHolder) return undefined
    return provider.deleteAccountHolder(input)
  }

  async listPaymentMethods(
    providerId: string,
    input: ListPaymentMethodsInput,
  ): Promise<ListPaymentMethodsOutput | undefined> {
    const provider = this.retrieveProvider(providerId)
    if (!provider.listPaymentMethods) return undefined
    return provider.listPaymentMethods(input)
  }

  async savePaymentMethod(
    providerId: string,
    input: SavePaymentMethodInput,
  ): Promise<SavePaymentMethodOutput | undefined> {
    const provider = this.retrieveProvider(providerId)
    if (!provider.savePaymentMethod) return undefined
    return provider.savePaymentMethod(input)
  }

  async deletePaymentMethod(
    providerId: string,
    input: DeletePaymentMethodInput,
  ): Promise<DeletePaymentMethodOutput | undefined> {
    const provider = this.retrieveProvider(providerId)
    if (!provider.deletePaymentMethod) return undefined
    return provider.deletePaymentMethod(input)
  }

  async getWebhookActionAndData(
    providerId: string,
    payload: ProviderWebhookPayload['payload'],
  ): Promise<WebhookActionResult> {
    this.logger.debug(`Processing webhook for provider "${providerId}"`)
    const provider = this.retrieveProvider(providerId)
    return provider.getWebhookActionAndData(payload)
  }
}
