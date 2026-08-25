import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { loadProviders } from './loaders/providers.js'
import * as models from './models/index.js'
import { AccountHolderRepository } from './repositories/account-holder.js'
import { CaptureRepository } from './repositories/capture.js'
import { PaymentRepository } from './repositories/payment.js'
import { PaymentCollectionRepository } from './repositories/payment-collection.js'
import { PaymentProviderRepository } from './repositories/payment-provider.js'
import { PaymentSessionRepository } from './repositories/payment-session.js'
import { RefundRepository } from './repositories/refund.js'
import { RefundReasonRepository } from './repositories/refund-reason.js'
import { PaymentModuleService } from './services/payment-module-service.js'

export { paymentProviderDeclarations } from './provider-declarations.js'
export { syncPaymentProviders } from './sync-providers.js'

export default Module(Modules.PAYMENT, {
  service: PaymentModuleService,
  models,
  repositories: {
    paymentCollectionRepository: PaymentCollectionRepository,
    paymentSessionRepository: PaymentSessionRepository,
    paymentRepository: PaymentRepository,
    captureRepository: CaptureRepository,
    refundRepository: RefundRepository,
    refundReasonRepository: RefundReasonRepository,
    paymentProviderRepository: PaymentProviderRepository,
    accountHolderRepository: AccountHolderRepository,
  },
  loaders: [loadProviders],
})
