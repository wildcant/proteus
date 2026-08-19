import { test as testBase } from 'vitest'
import type { Logger } from '../../src/core/types/logger.js'
import { noopLogger } from '../../src/framework/logger/noop-logger.js'
import type { Database } from '../../src/schema.type.js'
import {
  generateAuthIdentityDTO,
  generateCreateAuthIdentityDTO,
  generateCreateAuthPasswordResetTokenDTO,
  generateCreateAuthVerificationDTO,
  generateCreateProviderIdentityDTO,
  generateUpdateAuthIdentityDTO,
  generateUpdateAuthVerificationDTO,
  generateUpdateProviderIdentityDTO,
} from '../factories/auth-dto.js'
import {
  generateCartAddressDTO,
  generateCartDTO,
  generateCartLineItemDTO,
  generateCartShippingMethodDTO,
} from '../factories/cart-dto.js'
import {
  generateCreateCustomerAddressDTO,
  generateCreateCustomerDTO,
  generateCustomerDTO,
  generateUpdateCustomerDTO,
} from '../factories/customer-dto.js'
import { generateCustomer, generateProduct, generateUser } from '../factories/db/index.js'
import { generateInventoryLevelDTO, generateReservationItemDTO } from '../factories/inventory-dto.js'
import { generateProductVariantInventoryItemDTO } from '../factories/link-dto.js'
import { generateCreateNotificationDTO, generateNotificationDTO } from '../factories/notification-dto.js'
import {
  generateCreateOrderAddressDTO,
  generateCreateOrderDTO,
  generateCreateOrderLineItemDTO,
  generateCreateOrderShippingMethodDTO,
  generateCreateOrderTransactionDTO,
  generateOrderDTO,
  generateOrderLineItemDTO,
} from '../factories/order-dto.js'
import {
  generateCreateAccountHolderDTO,
  generateCreatePaymentCollectionDTO,
  generateCreatePaymentSessionDTO,
  generateCreateRefundReasonDTO,
  generatePaymentDTO,
  generatePaymentSessionDTO,
  generateUpdatePaymentCollectionDTO,
  generateUpdateRefundReasonDTO,
} from '../factories/payment-dto.js'
import { generateCreatePriceDTO, generateCreatePriceSetDTO } from '../factories/pricing-dto.js'
import { generateCreateProductDTO, generateUpdateProductDTO } from '../factories/product-dto.js'
import { generateCreateUserDTO, generateUpdateUserDTO, generateUserDTO } from '../factories/user-dto.js'
import { makeRequest } from '../utils/make-request.js'
import { db as dbInstance } from './db-setup.js'

export type Fixtures = {
  db: Database
  getDb: () => Database
  makeRequest: typeof makeRequest
  factories: {
    customer: typeof generateCustomer
    user: typeof generateUser
    product: typeof generateProduct
  }
  dto: {
    generate: {
      authIdentity: typeof generateAuthIdentityDTO
      createAuthIdentity: typeof generateCreateAuthIdentityDTO
      updateAuthIdentity: typeof generateUpdateAuthIdentityDTO
      createProviderIdentity: typeof generateCreateProviderIdentityDTO
      updateProviderIdentity: typeof generateUpdateProviderIdentityDTO
      createAuthVerification: typeof generateCreateAuthVerificationDTO
      updateAuthVerification: typeof generateUpdateAuthVerificationDTO
      createAuthPasswordResetToken: typeof generateCreateAuthPasswordResetTokenDTO
      createCustomer: typeof generateCreateCustomerDTO
      createCustomerAddress: typeof generateCreateCustomerAddressDTO
      updateCustomer: typeof generateUpdateCustomerDTO
      customer: typeof generateCustomerDTO
      createUser: typeof generateCreateUserDTO
      updateUser: typeof generateUpdateUserDTO
      user: typeof generateUserDTO
      createPaymentCollection: typeof generateCreatePaymentCollectionDTO
      updatePaymentCollection: typeof generateUpdatePaymentCollectionDTO
      createPaymentSession: typeof generateCreatePaymentSessionDTO
      paymentSession: typeof generatePaymentSessionDTO
      payment: typeof generatePaymentDTO
      createRefundReason: typeof generateCreateRefundReasonDTO
      updateRefundReason: typeof generateUpdateRefundReasonDTO
      createAccountHolder: typeof generateCreateAccountHolderDTO
      notification: typeof generateNotificationDTO
      createNotification: typeof generateCreateNotificationDTO
      createPriceSet: typeof generateCreatePriceSetDTO
      createPrice: typeof generateCreatePriceDTO
      createProduct: typeof generateCreateProductDTO
      updateProduct: typeof generateUpdateProductDTO
      createOrder: typeof generateCreateOrderDTO
      createOrderLineItem: typeof generateCreateOrderLineItemDTO
      createOrderShippingMethod: typeof generateCreateOrderShippingMethodDTO
      createOrderTransaction: typeof generateCreateOrderTransactionDTO
      createOrderAddress: typeof generateCreateOrderAddressDTO
      order: typeof generateOrderDTO
      orderLineItem: typeof generateOrderLineItemDTO
      reservationItem: typeof generateReservationItemDTO
      cart: typeof generateCartDTO
      cartAddress: typeof generateCartAddressDTO
      cartLineItem: typeof generateCartLineItemDTO
      cartShippingMethod: typeof generateCartShippingMethodDTO
      inventoryLevel: typeof generateInventoryLevelDTO
      productVariantInventoryItem: typeof generateProductVariantInventoryItemDTO
    }
  }
  logger: Logger
}

export const test = testBase.extend<Fixtures>({
  async db({ task: _ }, use) {
    await use(dbInstance)
  },
  async getDb({ task: _ }, use) {
    await use(() => dbInstance)
  },
  async makeRequest({ task: _ }, use) {
    await use(makeRequest)
  },
  async factories({ task: _ }, use) {
    await use({
      customer: generateCustomer,
      user: generateUser,
      product: generateProduct,
    })
  },
  async dto({ task: _ }, use) {
    await use({
      generate: {
        authIdentity: generateAuthIdentityDTO,
        createAuthIdentity: generateCreateAuthIdentityDTO,
        updateAuthIdentity: generateUpdateAuthIdentityDTO,
        createProviderIdentity: generateCreateProviderIdentityDTO,
        updateProviderIdentity: generateUpdateProviderIdentityDTO,
        createAuthVerification: generateCreateAuthVerificationDTO,
        updateAuthVerification: generateUpdateAuthVerificationDTO,
        createAuthPasswordResetToken: generateCreateAuthPasswordResetTokenDTO,
        createCustomer: generateCreateCustomerDTO,
        createCustomerAddress: generateCreateCustomerAddressDTO,
        updateCustomer: generateUpdateCustomerDTO,
        customer: generateCustomerDTO,
        createUser: generateCreateUserDTO,
        updateUser: generateUpdateUserDTO,
        user: generateUserDTO,
        createPaymentCollection: generateCreatePaymentCollectionDTO,
        updatePaymentCollection: generateUpdatePaymentCollectionDTO,
        createPaymentSession: generateCreatePaymentSessionDTO,
        paymentSession: generatePaymentSessionDTO,
        payment: generatePaymentDTO,
        createRefundReason: generateCreateRefundReasonDTO,
        updateRefundReason: generateUpdateRefundReasonDTO,
        createAccountHolder: generateCreateAccountHolderDTO,
        notification: generateNotificationDTO,
        createNotification: generateCreateNotificationDTO,
        createPriceSet: generateCreatePriceSetDTO,
        createPrice: generateCreatePriceDTO,
        createProduct: generateCreateProductDTO,
        updateProduct: generateUpdateProductDTO,
        createOrder: generateCreateOrderDTO,
        createOrderLineItem: generateCreateOrderLineItemDTO,
        createOrderShippingMethod: generateCreateOrderShippingMethodDTO,
        createOrderTransaction: generateCreateOrderTransactionDTO,
        createOrderAddress: generateCreateOrderAddressDTO,
        order: generateOrderDTO,
        orderLineItem: generateOrderLineItemDTO,
        reservationItem: generateReservationItemDTO,
        cart: generateCartDTO,
        cartAddress: generateCartAddressDTO,
        cartLineItem: generateCartLineItemDTO,
        cartShippingMethod: generateCartShippingMethodDTO,
        inventoryLevel: generateInventoryLevelDTO,
        productVariantInventoryItem: generateProductVariantInventoryItemDTO,
      },
    })
  },
  async logger({ task: _ }, use) {
    await use(noopLogger)
  },
})
