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
  generateCreateCartAddressDTO,
  generateCreateCartDTO,
  generateCreateLineItemDTO,
  generateCreateShippingMethodDTO,
  generateUpdateCartDTO,
  generateUpdateCartWithAddressesDTO,
} from '../factories/cart-dto.js'
import {
  generateCreateCustomerAddressDTO,
  generateCreateCustomerDTO,
  generateCustomerDTO,
  generateUpdateCustomerDTO,
} from '../factories/customer-dto.js'
import {
  createCountry,
  createRegion,
  createRegionPaymentProvider,
  createStore,
  createStoreCurrency,
  generateCustomer,
  generateProduct,
  generateUser,
  setPaymentProviderEnabled,
} from '../factories/db/index.js'
import {
  generateCreateFulfillmentSetDTO,
  generateCreateGeoZoneDTO,
  generateCreateServiceZoneDTO,
  generateFulfillmentDTO,
  generateUpdateFulfillmentDTO,
} from '../factories/fulfillment-dto.js'
import { generateStoreCreateAddressBody } from '../factories/http/index.js'
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
  generateUpdateOrderDTO,
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
  addCartAddresses,
  addImageToVariant,
  addInventoryLevel,
  addLineItem,
  addShippingMethod,
  cancelPayment,
  capturePayment,
  confirmAuthVerification,
  createAuthIdentity,
  createCart,
  createCheckoutReadyCart,
  createCustomer,
  createCustomerAddress,
  createOrder,
  createPaymentSessionForCart,
  createProduct,
  createProductOption,
  createProducts,
  createProductVariant,
  createProductVariants,
  createSellableVariant,
  fulfillOrder,
  linkRepo,
  listAuthVerifications,
  listCartAddresses,
  listCarts,
  listCustomerAddresses,
  listCustomers,
  listLineItems,
  listNotifications,
  listOrderAddresses,
  listOrderLineItems,
  listOrderShippingMethods,
  listOrders,
  listOrderTransactions,
  listPrices,
  listProductImages,
  listProductOptionsForProduct,
  listProducts,
  listProductVariantImages,
  listProductVariants,
  listReservationItems,
  priceVariants,
  requestAuthVerification,
  retrieveAuthIdentity,
  retrieveCart,
  retrieveCustomer,
  retrieveFulfillment,
  retrieveOrder,
  retrievePayment,
  retrievePaymentCollection,
  retrieveProductVariant,
  setProductOptions,
  shipOrder,
  stockVariant,
  updateAuthIdentity,
  updateAuthVerification,
  updateCart,
  updateFulfillment,
  updateOrder,
  updateProductVariant,
} from '../factories/services/index.js'
import { generateCreateUserDTO, generateUpdateUserDTO, generateUserDTO } from '../factories/user-dto.js'
import { type CreateApiOptions, createApi, type TestApi } from './create-api.js'
import { type CreateContainerOptions, createTestContainer, type TestContainer } from './create-container.js'
import { db as dbInstance } from './db-setup.js'
import { runStep, runStepAndCompensate } from './run-step.js'

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
  /** The bootstrapped container on its own — no routes, no listening server. What a workflow or
   *  service test wants; `createApi` is the same container with an HTTP surface around it.
   *  Disposed after the test. */
  createTestContainer: (options?: CreateContainerOptions) => Promise<TestContainer>
  /** Runs a bare workflow step against whatever container is currently registered — the one
   *  `createApi` built. Steps are written to be composed, so exercising one alone means
   *  wrapping it in a throwaway workflow. */
  step: {
    run: typeof runStep
    runAndCompensate: typeof runStepAndCompensate
  }
  factories: {
    customer: typeof generateCustomer
    user: typeof generateUser
    product: typeof generateProduct
    /** Rows written straight to the database, for tables no module service writes yet — region,
     *  country and store are seeded, and their admin write paths are separate features. Each
     *  returns a disposable, so a spec's rows live and die with it. */
    create: {
      region: typeof createRegion
      country: typeof createCountry
      /** Which payment providers a region offers. The providers themselves are seeded by the
       *  payment module's loader when the container boots, so a test links to them by id. */
      regionPaymentProvider: typeof createRegionPaymentProvider
      store: typeof createStore
      storeCurrency: typeof createStoreCurrency
    }
    update: {
      paymentProviderEnabled: typeof setPaymentProviderEnabled
    }
  }
  /** Request bodies for the HTTP layer, grouped by the API scope they belong to — the same split
   *  `@proteus/http-schemas` makes between `./store` and `./admin`. A wire body is not a service
   *  DTO: it has its own required fields, so a test that posts one needs a generator for the same
   *  reason a test that persists one does. */
  http: {
    store: {
      createAddress: typeof generateStoreCreateAddressBody
    }
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
      createCartAddress: typeof generateCreateCartAddressDTO
      updateCartWithAddresses: typeof generateUpdateCartWithAddressesDTO
      fulfillment: typeof generateFulfillmentDTO
      updateFulfillment: typeof generateUpdateFulfillmentDTO
      createFulfillmentSet: typeof generateCreateFulfillmentSetDTO
      createServiceZone: typeof generateCreateServiceZoneDTO
      createGeoZone: typeof generateCreateGeoZoneDTO
      updateCart: typeof generateUpdateCartDTO
      updateOrder: typeof generateUpdateOrderDTO
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
      cartAddresses: typeof addCartAddresses
      customer: typeof createCustomer
      customerAddress: typeof createCustomerAddress
      lineItem: typeof addLineItem
      shippingMethod: typeof addShippingMethod
      variantStock: typeof stockVariant
      inventoryLevel: typeof addInventoryLevel
      paymentSessionForCart: typeof createPaymentSessionForCart
      capturedPayment: typeof capturePayment
      canceledPayment: typeof cancelPayment
      checkoutReadyCart: typeof createCheckoutReadyCart
      sellableVariant: typeof createSellableVariant
      order: typeof createOrder
      fulfilledOrder: typeof fulfillOrder
      shippedOrder: typeof shipOrder
      product: typeof createProduct
      products: typeof createProducts
      productOption: typeof createProductOption
      productVariant: typeof createProductVariant
      productVariants: typeof createProductVariants
      variantImages: typeof addImageToVariant
      variantPrices: typeof priceVariants
      authVerification: typeof requestAuthVerification
      confirmedAuthVerification: typeof confirmAuthVerification
      authIdentity: typeof createAuthIdentity
    }
    update: {
      productOptions: typeof setProductOptions
      productVariant: typeof updateProductVariant
      authIdentity: typeof updateAuthIdentity
      authVerification: typeof updateAuthVerification
      cart: typeof updateCart
      fulfillment: typeof updateFulfillment
      order: typeof updateOrder
    }
    read: {
      authIdentity: typeof retrieveAuthIdentity
      cart: typeof retrieveCart
      cartAddresses: typeof listCartAddresses
      carts: typeof listCarts
      cartLineItems: typeof listLineItems
      customer: typeof retrieveCustomer
      customerAddresses: typeof listCustomerAddresses
      customers: typeof listCustomers
      authVerifications: typeof listAuthVerifications
      notifications: typeof listNotifications
      fulfillment: typeof retrieveFulfillment
      order: typeof retrieveOrder
      orders: typeof listOrders
      orderAddresses: typeof listOrderAddresses
      orderLineItems: typeof listOrderLineItems
      orderShippingMethods: typeof listOrderShippingMethods
      orderTransactions: typeof listOrderTransactions
      payment: typeof retrievePayment
      paymentCollection: typeof retrievePaymentCollection
      reservationItems: typeof listReservationItems
      linkRepo: typeof linkRepo
      prices: typeof listPrices
      products: typeof listProducts
      productVariants: typeof listProductVariants
      productVariant: typeof retrieveProductVariant
      productImages: typeof listProductImages
      productOptionsForProduct: typeof listProductOptionsForProduct
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
  async step({ task: _ }, use) {
    await use({ run: runStep, runAndCompensate: runStepAndCompensate })
  },
  async createTestContainer({ getDb, logger }, use) {
    const created: Array<() => Promise<void>> = []
    await use(async (options) => {
      const { container, close } = await createTestContainer({ getDb, logger }, options)
      created.push(close)
      return container
    })
    await Promise.all(created.map((close) => close()))
  },
  async factories({ task: _ }, use) {
    await use({
      customer: generateCustomer,
      user: generateUser,
      product: generateProduct,
      create: {
        region: createRegion,
        country: createCountry,
        regionPaymentProvider: createRegionPaymentProvider,
        store: createStore,
        storeCurrency: createStoreCurrency,
      },
      update: {
        paymentProviderEnabled: setPaymentProviderEnabled,
      },
    })
  },
  async http({ task: _ }, use) {
    await use({
      store: {
        createAddress: generateStoreCreateAddressBody,
      },
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
        createCartAddress: generateCreateCartAddressDTO,
        updateCartWithAddresses: generateUpdateCartWithAddressesDTO,
        fulfillment: generateFulfillmentDTO,
        updateFulfillment: generateUpdateFulfillmentDTO,
        createFulfillmentSet: generateCreateFulfillmentSetDTO,
        createServiceZone: generateCreateServiceZoneDTO,
        createGeoZone: generateCreateGeoZoneDTO,
        updateCart: generateUpdateCartDTO,
        updateOrder: generateUpdateOrderDTO,
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
        cartAddresses: addCartAddresses,
        customer: createCustomer,
        customerAddress: createCustomerAddress,
        lineItem: addLineItem,
        shippingMethod: addShippingMethod,
        variantStock: stockVariant,
        inventoryLevel: addInventoryLevel,
        paymentSessionForCart: createPaymentSessionForCart,
        capturedPayment: capturePayment,
        canceledPayment: cancelPayment,
        checkoutReadyCart: createCheckoutReadyCart,
        sellableVariant: createSellableVariant,
        order: createOrder,
        fulfilledOrder: fulfillOrder,
        shippedOrder: shipOrder,
        product: createProduct,
        products: createProducts,
        productOption: createProductOption,
        productVariant: createProductVariant,
        productVariants: createProductVariants,
        variantImages: addImageToVariant,
        variantPrices: priceVariants,
        authVerification: requestAuthVerification,
        confirmedAuthVerification: confirmAuthVerification,
        authIdentity: createAuthIdentity,
      },
      update: {
        productOptions: setProductOptions,
        productVariant: updateProductVariant,
        authIdentity: updateAuthIdentity,
        authVerification: updateAuthVerification,
        cart: updateCart,
        fulfillment: updateFulfillment,
        order: updateOrder,
      },
      read: {
        authIdentity: retrieveAuthIdentity,
        cart: retrieveCart,
        cartAddresses: listCartAddresses,
        carts: listCarts,
        cartLineItems: listLineItems,
        customer: retrieveCustomer,
        customerAddresses: listCustomerAddresses,
        customers: listCustomers,
        authVerifications: listAuthVerifications,
        notifications: listNotifications,
        fulfillment: retrieveFulfillment,
        order: retrieveOrder,
        orders: listOrders,
        orderAddresses: listOrderAddresses,
        orderLineItems: listOrderLineItems,
        orderShippingMethods: listOrderShippingMethods,
        orderTransactions: listOrderTransactions,
        payment: retrievePayment,
        paymentCollection: retrievePaymentCollection,
        reservationItems: listReservationItems,
        linkRepo,
        prices: listPrices,
        products: listProducts,
        productVariants: listProductVariants,
        productVariant: retrieveProductVariant,
        productImages: listProductImages,
        productOptionsForProduct: listProductOptionsForProduct,
        productVariantImages: listProductVariantImages,
      },
    })
  },
  async logger({ task: _ }, use) {
    await use(noopLogger)
  },
})
