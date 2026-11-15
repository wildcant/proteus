import { i18n } from '@proteus/utils'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
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

/**
 * The manual payment provider: money taken outside Proteus — a bank transfer, cash on delivery, a
 * terminal — and recorded by an admin. It talks to no gateway and authorizes whatever it is handed,
 * which is what lets an Order's collection be authorized for its total and captured a deposit at a
 * time. A Region offers it at checkout only when the admin links it to that Region.
 */
export class SystemPaymentProvider extends AbstractPaymentProvider {
  static identifier = 'system'
  static label = 'Manual Payment'
  static canCapturePartially = true

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
    throw new AppError({ type: ErrorTypes.NOT_ALLOWED, message: i18n.t('Method not implemented.') })
  }

  async getWebhookActionAndData(_data: ProviderWebhookPayload['payload']): Promise<WebhookActionResult> {
    return { action: 'not_supported' }
  }
}
