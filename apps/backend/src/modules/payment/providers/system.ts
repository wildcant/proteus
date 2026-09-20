import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '../../../core/types/payment/mutations.js'
import { AbstractPaymentProvider } from '../../../core/utils/abstract-payment-provider.js'

export class SystemPaymentProvider extends AbstractPaymentProvider {
  static identifier = 'system'
  static label = 'Manual Payment'
  static isTestOnly = true

  constructor() {
    super({}, {} as Record<string, unknown>)
  }

  async initiatePayment(_input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    return { id: crypto.randomUUID(), data: {} }
  }

  async authorizePayment(_input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return { status: 'authorized', data: {} }
  }

  async capturePayment(_input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: {} }
  }

  async cancelPayment(_input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: {} }
  }

  async deletePayment(_input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: {} }
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return { data: {} }
  }

  async retrievePayment(_input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: {} }
  }

  async updatePayment(_input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: {} }
  }

  async getPaymentStatus(_input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    throw new AppError({ type: ErrorTypes.NOT_ALLOWED, message: 'Method not implemented.' })
  }

  async getWebhookActionAndData(_data: ProviderWebhookPayload['payload']): Promise<WebhookActionResult> {
    return { action: 'not_supported' }
  }
}
