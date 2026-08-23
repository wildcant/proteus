import { defineAppConfig } from '@core/config/index.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { test as testBase } from 'vitest'
import type { Logger } from '../../src/core/types/logger.js'
import { noopLogger } from '../../src/framework/logger/noop-logger.js'
import type { Database } from '../../src/schema.type.js'
import type { HttpRequest } from '../../src/server/ports.js'
import {
  generateAuthIdentityDTO,
  generateConfirmAuthVerificationDTO,
  generateCreateAuthIdentityDTO,
  generateCreateAuthPasswordResetTokenDTO,
  generateCreateAuthVerificationDTO,
  generateCreateProviderIdentityDTO,
  generateProviderIdentityDTO,
  generateRequestAuthVerificationDTO,
  generateUpdateAuthIdentityDTO,
  generateUpdateAuthVerificationDTO,
  generateUpdateProviderIdentityDTO,
} from '../factories/auth-dto.js'
import {
  generateCartAddressDTO,
  generateCartDTO,
  generateCartLineItemDTO,
  generateCartShippingMethodDTO,
  generateCreateCartDTO,
  generateCreateLineItemDTO,
  generateCreateShippingMethodDTO,
} from '../factories/cart-dto.js'
import {
  generateCreateCustomerAddressDTO,
  generateCreateCustomerDTO,
  generateCustomerDTO,
  generateUpdateCustomerDTO,
} from '../factories/customer-dto.js'
import { generateCustomer, generateProduct, generateUser } from '../factories/db/index.js'
import { generateFulfillmentDTO } from '../factories/fulfillment-dto.js'
import {
  generateCreateInventoryItemDTO,
  generateCreateInventoryLevelDTO,
  generateInventoryLevelDTO,
  generateReservationItemDTO,
} from '../factories/inventory-dto.js'
import { generateProductVariantInventoryItemDTO, generateProductVariantPriceSetDTO } from '../factories/link-dto.js'
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
import {
  generateCalculatedPriceSetDTO,
  generateCreatePriceDTO,
  generateCreatePriceSetDTO,
} from '../factories/pricing-dto.js'
import {
  generateCreateProductDTO,
  generateCreateProductOptionDTO,
  generateCreateProductOptionValueDTO,
  generateCreateProductVariantDTO,
  generateSetProductOptionsDTO,
  generateUpdateProductDTO,
  generateUpdateProductVariantDTO,
  generateVariantImageInputDTO,
} from '../factories/product-dto.js'
import {
  addImageToVariant,
  addLineItem,
  addShippingMethod,
  confirmAuthVerification,
  createCart,
  createCheckoutReadyCart,
  createPaymentSessionForCart,
  createProduct,
  createProductOption,
  createProductVariant,
  createProductVariants,
  linkRepo,
  listAuthVerifications,
  listOrders,
  listProductImages,
  listProducts,
  listProductVariantImages,
  listProductVariants,
  listReservationItems,
  priceVariants,
  requestAuthVerification,
  retrievePaymentCollection,
  retrieveProductVariant,
  setProductOptions,
  stockVariant,
  updateAuthIdentity,
  updateAuthVerification,
  updateProductVariant,
} from '../factories/services/index.js'
import { generateCreateUserDTO, generateUpdateUserDTO, generateUserDTO } from '../factories/user-dto.js'
import { type CreateApiOptions, createApi, type TestApi } from './create-api.js'
import { db as dbInstance } from './db-setup.js'

function makeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    params: {},
    query: {},
    validatedQuery: {},
    body: undefined,
    scope: {
      resolve: (key: string) => {
        if (key === ContainerRegistrationKeys.CONFIG_MODULE) return defineAppConfig()
        throw new Error(`Unexpected resolve: ${key}`)
      },
    } as unknown as HttpRequest['scope'],
    headers: {},
    ...overrides,
  }
}

export type Fixtures = {
  db: Database
  getDb: () => Database
  makeRequest: typeof makeRequest
  /** Builds a bootstrapped container, and an Express server when definitions are passed.
   *  Everything it creates is closed after the test. */
  createApi: (options?: CreateApiOptions) => Promise<TestApi>
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
      providerIdentity: typeof generateProviderIdentityDTO
      createProviderIdentity: typeof generateCreateProviderIdentityDTO
      updateProviderIdentity: typeof generateUpdateProviderIdentityDTO
      createAuthVerification: typeof generateCreateAuthVerificationDTO
      requestAuthVerification: typeof generateRequestAuthVerificationDTO
      confirmAuthVerification: typeof generateConfirmAuthVerificationDTO
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
      createProductOption: typeof generateCreateProductOptionDTO
      createProductOptionValue: typeof generateCreateProductOptionValueDTO
      createProductVariant: typeof generateCreateProductVariantDTO
      updateProduct: typeof generateUpdateProductDTO
      updateProductVariant: typeof generateUpdateProductVariantDTO
      setProductOptions: typeof generateSetProductOptionsDTO
      variantImageInput: typeof generateVariantImageInputDTO
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
      createCart: typeof generateCreateCartDTO
      createLineItem: typeof generateCreateLineItemDTO
      createShippingMethod: typeof generateCreateShippingMethodDTO
      fulfillment: typeof generateFulfillmentDTO
      inventoryLevel: typeof generateInventoryLevelDTO
      createInventoryItem: typeof generateCreateInventoryItemDTO
      createInventoryLevel: typeof generateCreateInventoryLevelDTO
      productVariantInventoryItem: typeof generateProductVariantInventoryItemDTO
      productVariantPriceSet: typeof generateProductVariantPriceSetDTO
      calculatedPriceSet: typeof generateCalculatedPriceSetDTO
    }
  }
  /** The module services reached through factories, for tests that run against a bootstrapped
   *  container. Each takes that container as its first argument, so no test resolves a service
   *  itself: `create` arranges state, `update` mutates it mid-test, `read` is for assertions. */
  service: {
    create: {
      cart: typeof createCart
      lineItem: typeof addLineItem
      shippingMethod: typeof addShippingMethod
      variantStock: typeof stockVariant
      paymentSessionForCart: typeof createPaymentSessionForCart
      checkoutReadyCart: typeof createCheckoutReadyCart
      product: typeof createProduct
      productOption: typeof createProductOption
      productVariant: typeof createProductVariant
      productVariants: typeof createProductVariants
      variantImages: typeof addImageToVariant
      variantPrices: typeof priceVariants
      authVerification: typeof requestAuthVerification
      confirmedAuthVerification: typeof confirmAuthVerification
    }
    update: {
      productOptions: typeof setProductOptions
      productVariant: typeof updateProductVariant
      authIdentity: typeof updateAuthIdentity
      authVerification: typeof updateAuthVerification
    }
    read: {
      authVerifications: typeof listAuthVerifications
      orders: typeof listOrders
      paymentCollection: typeof retrievePaymentCollection
      reservationItems: typeof listReservationItems
      linkRepo: typeof linkRepo
      products: typeof listProducts
      productVariants: typeof listProductVariants
      productVariant: typeof retrieveProductVariant
      productImages: typeof listProductImages
      productVariantImages: typeof listProductVariantImages
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
  async createApi({ getDb, logger }, use) {
    const created: TestApi[] = []
    await use(async (options) => {
      const api = await createApi({ getDb, logger }, options)
      created.push(api)
      return api
    })
    await Promise.all(created.map((api) => api.close()))
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
        providerIdentity: generateProviderIdentityDTO,
        createProviderIdentity: generateCreateProviderIdentityDTO,
        updateProviderIdentity: generateUpdateProviderIdentityDTO,
        createAuthVerification: generateCreateAuthVerificationDTO,
        requestAuthVerification: generateRequestAuthVerificationDTO,
        confirmAuthVerification: generateConfirmAuthVerificationDTO,
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
        createProductOption: generateCreateProductOptionDTO,
        createProductOptionValue: generateCreateProductOptionValueDTO,
        createProductVariant: generateCreateProductVariantDTO,
        updateProduct: generateUpdateProductDTO,
        updateProductVariant: generateUpdateProductVariantDTO,
        setProductOptions: generateSetProductOptionsDTO,
        variantImageInput: generateVariantImageInputDTO,
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
        createCart: generateCreateCartDTO,
        createLineItem: generateCreateLineItemDTO,
        createShippingMethod: generateCreateShippingMethodDTO,
        fulfillment: generateFulfillmentDTO,
        inventoryLevel: generateInventoryLevelDTO,
        createInventoryItem: generateCreateInventoryItemDTO,
        createInventoryLevel: generateCreateInventoryLevelDTO,
        productVariantInventoryItem: generateProductVariantInventoryItemDTO,
        productVariantPriceSet: generateProductVariantPriceSetDTO,
        calculatedPriceSet: generateCalculatedPriceSetDTO,
      },
    })
  },
  async service({ task: _ }, use) {
    await use({
      create: {
        cart: createCart,
        lineItem: addLineItem,
        shippingMethod: addShippingMethod,
        variantStock: stockVariant,
        paymentSessionForCart: createPaymentSessionForCart,
        checkoutReadyCart: createCheckoutReadyCart,
        product: createProduct,
        productOption: createProductOption,
        productVariant: createProductVariant,
        productVariants: createProductVariants,
        variantImages: addImageToVariant,
        variantPrices: priceVariants,
        authVerification: requestAuthVerification,
        confirmedAuthVerification: confirmAuthVerification,
      },
      update: {
        productOptions: setProductOptions,
        productVariant: updateProductVariant,
        authIdentity: updateAuthIdentity,
        authVerification: updateAuthVerification,
      },
      read: {
        authVerifications: listAuthVerifications,
        orders: listOrders,
        paymentCollection: retrievePaymentCollection,
        reservationItems: listReservationItems,
        linkRepo,
        products: listProducts,
        productVariants: listProductVariants,
        productVariant: retrieveProductVariant,
        productImages: listProductImages,
        productVariantImages: listProductVariantImages,
      },
    })
  },
  async logger({ task: _ }, use) {
    await use(noopLogger)
  },
})
