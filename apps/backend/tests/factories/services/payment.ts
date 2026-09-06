import type { AwilixContainer } from 'awilix'
import type { BigNumber } from '../../../src/core/bignumber.js'
import type { ILinkService } from '../../../src/core/types/link/service.js'
import type { IPaymentModuleService } from '../../../src/core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules } from '../../../src/core/utils/index.js'
import { generateCreatePaymentCollectionDTO, generateCreatePaymentSessionDTO } from '../payment-dto.js'

export type PaymentSessionForCartOptions = {
  cartId: string
  amount: BigNumber
  currencyCode?: string
  /** Full DI registration key, not the bare provider name — `PaymentProviderService.retrieveProvider`
   *  resolves it from the container verbatim. `pp_system_default` is always registered. */
  providerId?: string
}

/**
 * Gives a cart something to pay with: a payment collection, a session on it, and the
 * cart↔collection link `validate-cart-payments` looks the collection up through.
 */
export async function createPaymentSessionForCart(container: AwilixContainer, options: PaymentSessionForCartOptions) {
  const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const currencyCode = options.currencyCode ?? 'usd'

  const paymentCollection = await paymentService.createPaymentCollection(
    generateCreatePaymentCollectionDTO({ amount: options.amount, currencyCode }),
  )

  const paymentSession = await paymentService.createPaymentSession(
    paymentCollection.id,
    generateCreatePaymentSessionDTO({
      providerId: options.providerId ?? 'pp_system_default',
      amount: options.amount,
      currencyCode,
    }),
  )

  await linkService.repo('cartPaymentCollection').create({
    cartId: options.cartId,
    paymentCollectionId: paymentCollection.id,
  })

  return { paymentCollection, paymentSession }
}

/** Takes the money for real, so the payment carries a capture the way a completed order's does. */
export async function capturePayment(container: AwilixContainer, paymentId: string) {
  const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

  return paymentService.capturePayment({ paymentId })
}

export async function cancelPayment(container: AwilixContainer, paymentId: string) {
  const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

  return paymentService.cancelPayment(paymentId)
}

// ---- Reads ----

export async function retrievePaymentCollection(container: AwilixContainer, paymentCollectionId: string) {
  const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

  return paymentService.retrievePaymentCollection(paymentCollectionId)
}

export async function retrievePayment(container: AwilixContainer, paymentId: string) {
  const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

  return paymentService.retrievePayment(paymentId)
}
