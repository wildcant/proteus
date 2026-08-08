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
import { generateCustomer } from '../factories/customer.js'
import {
  generateCreateCustomerAddressDTO,
  generateCreateCustomerDTO,
  generateCustomerDTO,
  generateUpdateCustomerDTO,
} from '../factories/customer-dto.js'
import { generateCreateNotificationDTO } from '../factories/notification-dto.js'
import {
  generateCreateAccountHolderDTO,
  generateCreatePaymentCollectionDTO,
  generateCreatePaymentSessionDTO,
  generateCreateRefundReasonDTO,
  generateUpdatePaymentCollectionDTO,
  generateUpdateRefundReasonDTO,
} from '../factories/payment-dto.js'
import { generateCreateProductDTO, generateUpdateProductDTO } from '../factories/product-dto.js'
import { generateUser } from '../factories/user.js'
import { generateCreateUserDTO, generateUpdateUserDTO, generateUserDTO } from '../factories/user-dto.js'
import { makeRequest } from '../utils/make-request.js'
import { db as dbInstance } from './db-setup.js'

type Fixtures = {
  db: Database
  getDb: () => Database
  makeRequest: typeof makeRequest
  factories: {
    customer: typeof generateCustomer
    user: typeof generateUser
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
      createRefundReason: typeof generateCreateRefundReasonDTO
      updateRefundReason: typeof generateUpdateRefundReasonDTO
      createAccountHolder: typeof generateCreateAccountHolderDTO
      createNotification: typeof generateCreateNotificationDTO
      createProduct: typeof generateCreateProductDTO
      updateProduct: typeof generateUpdateProductDTO
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
        createRefundReason: generateCreateRefundReasonDTO,
        updateRefundReason: generateUpdateRefundReasonDTO,
        createAccountHolder: generateCreateAccountHolderDTO,
        createNotification: generateCreateNotificationDTO,
        createProduct: generateCreateProductDTO,
        updateProduct: generateUpdateProductDTO,
      },
    })
  },
  async logger({ task: _ }, use) {
    await use(noopLogger)
  },
})
