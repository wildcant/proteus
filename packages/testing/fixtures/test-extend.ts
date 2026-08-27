import { test as base, expect } from '@playwright/test'
import { interpolatePath } from '@tanstack/react-router'
import {
  createCart,
  createCustomer,
  createFulfillmentProvider,
  createFulfillmentSet,
  createGeoZone,
  createPaymentProvider,
  createPrice,
  createPriceSet,
  createProduct,
  createProductImage,
  createProductOption,
  createProductOptionValue,
  createProductProductOption,
  createProductProductOptionValue,
  createProductVariant,
  createProductVariantImage,
  createProductVariantOption,
  createProductVariantPriceSet,
  createProductWithOption,
  createProductWithPricing,
  createServiceZone,
  createShippingOption,
  createShippingOptionType,
  createShippingOptionWithZone,
  createShippingProfile,
  createUser,
  deleteCartById,
  deleteCustomerById,
  deleteFulfillmentProviderById,
  deleteFulfillmentSetById,
  deleteGeoZoneById,
  deleteNotificationsByIds,
  deletePaymentProviderById,
  deletePriceById,
  deletePriceSetById,
  deleteProductById,
  deleteProductImageById,
  deleteProductOptionById,
  deleteProductOptionValueById,
  deleteProductProductOptionById,
  deleteProductProductOptionValueById,
  deleteProductVariantImageById,
  deleteProductVariantOptionById,
  deleteProductVariantPriceSetById,
  deleteServiceZoneById,
  deleteShippingOptionById,
  deleteShippingOptionTypeById,
  deleteShippingProfileById,
  deleteUserById,
  generateCart,
  generateCustomer,
  generateFulfillmentProvider,
  generateFulfillmentSet,
  generateGeoZone,
  generatePaymentProvider,
  generatePrice,
  generatePriceSet,
  generateProduct,
  generateProductImage,
  generateProductOption,
  generateProductOptionValue,
  generateProductProductOption,
  generateProductProductOptionValue,
  generateProductVariant,
  generateProductVariantImage,
  generateProductVariantOption,
  generateProductVariantPriceSet,
  generateServiceZone,
  generateShippingOption,
  generateShippingOptionType,
  generateShippingProfile,
  generateUser,
  retrieveCustomer,
  retrieveNotification,
} from 'backend/test'
import { type AuthenticateFunction, combinePersonas, definePersona } from 'playwright-persona'
import { generateLoginFormValues, generateRegisterFormValues } from '../factories/form-values.js'

type NavigateOptions<RoutePath extends string> = {
  to: RoutePath
  params?: Record<string, string>
  search?: Record<string, string>
}

type NavigateFunction<RoutePath extends string> = (options: NavigateOptions<RoutePath>) => Promise<void>

export type CleanupFunction = {
  add: (fn: () => Promise<void>) => void
}

const admin = definePersona('admin', {
  async createSession({ page }) {
    const user = await createUser()
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/')
    return { userId: user.id, name: user.name }
  },
  async verifySession({ page, session }) {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: session.name })).toBeVisible({
      timeout: 2_000,
    })
  },
  async destroySession({ session }) {
    await deleteUserById(session.userId)
  },
})

const customer = definePersona('customer', {
  async createSession({ page }) {
    const customer = await createCustomer()
    await page.goto('/login')
    await page.getByLabel('Email').fill(customer.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/account')
    return { customerId: customer.id, email: customer.email }
  },
  async verifySession({ page, session }) {
    await page.goto('/account', { waitUntil: 'networkidle' })
    // The Details panel is the only place the signed-in customer's email appears, and it is
    // customer-scoped, so seeing it proves the restored session still resolves /store/customers/me.
    await expect(page.getByText(session.email).first()).toBeVisible({
      timeout: 2_000,
    })
  },
  async destroySession({ session }) {
    await deleteCustomerById(session.customerId)
  },
})

/** The database factories exposed on the `factories` fixture. */
export type Factories = {
  generate: {
    cart: typeof generateCart
    customer: typeof generateCustomer
    user: typeof generateUser
    product: typeof generateProduct
    productImage: typeof generateProductImage
    productVariant: typeof generateProductVariant
    productVariantImage: typeof generateProductVariantImage
    productOption: typeof generateProductOption
    productOptionValue: typeof generateProductOptionValue
    productProductOption: typeof generateProductProductOption
    productProductOptionValue: typeof generateProductProductOptionValue
    productVariantOption: typeof generateProductVariantOption
    priceSet: typeof generatePriceSet
    price: typeof generatePrice
    productVariantPriceSet: typeof generateProductVariantPriceSet
    fulfillmentProvider: typeof generateFulfillmentProvider
    fulfillmentSet: typeof generateFulfillmentSet
    serviceZone: typeof generateServiceZone
    geoZone: typeof generateGeoZone
    shippingProfile: typeof generateShippingProfile
    shippingOptionType: typeof generateShippingOptionType
    shippingOption: typeof generateShippingOption
    paymentProvider: typeof generatePaymentProvider
    loginForm: typeof generateLoginFormValues
    customerSignupForm: typeof generateRegisterFormValues
  }
  read: {
    customer: typeof retrieveCustomer
    notification: typeof retrieveNotification
  }
  create: {
    cart: typeof createCart
    customer: typeof createCustomer
    user: typeof createUser
    product: typeof createProduct
    productImage: typeof createProductImage
    productVariant: typeof createProductVariant
    productVariantImage: typeof createProductVariantImage
    productOption: typeof createProductOption
    productOptionValue: typeof createProductOptionValue
    productProductOption: typeof createProductProductOption
    productProductOptionValue: typeof createProductProductOptionValue
    productVariantOption: typeof createProductVariantOption
    priceSet: typeof createPriceSet
    price: typeof createPrice
    productVariantPriceSet: typeof createProductVariantPriceSet
    productWithOption: typeof createProductWithOption
    productWithPricing: typeof createProductWithPricing
    shippingOptionWithZone: typeof createShippingOptionWithZone
    fulfillmentProvider: typeof createFulfillmentProvider
    fulfillmentSet: typeof createFulfillmentSet
    serviceZone: typeof createServiceZone
    geoZone: typeof createGeoZone
    shippingProfile: typeof createShippingProfile
    shippingOptionType: typeof createShippingOptionType
    shippingOption: typeof createShippingOption
    paymentProvider: typeof createPaymentProvider
  }
  destroy: {
    cart: typeof deleteCartById
    notification: typeof deleteNotificationsByIds
    customer: typeof deleteCustomerById
    user: typeof deleteUserById
    product: typeof deleteProductById
    productImage: typeof deleteProductImageById
    productVariantImage: typeof deleteProductVariantImageById
    productOption: typeof deleteProductOptionById
    productOptionValue: typeof deleteProductOptionValueById
    productProductOption: typeof deleteProductProductOptionById
    productProductOptionValue: typeof deleteProductProductOptionValueById
    productVariantOption: typeof deleteProductVariantOptionById
    priceSet: typeof deletePriceSetById
    price: typeof deletePriceById
    productVariantPriceSet: typeof deleteProductVariantPriceSetById
    fulfillmentProvider: typeof deleteFulfillmentProviderById
    fulfillmentSet: typeof deleteFulfillmentSetById
    serviceZone: typeof deleteServiceZoneById
    geoZone: typeof deleteGeoZoneById
    shippingProfile: typeof deleteShippingProfileById
    shippingOptionType: typeof deleteShippingOptionTypeById
    shippingOption: typeof deleteShippingOptionById
    paymentProvider: typeof deletePaymentProviderById
  }
}

export function createTest<RoutePath extends string = string>() {
  const test = base.extend<{
    factories: Factories
    navigate: NavigateFunction<RoutePath>
    authenticate: AuthenticateFunction<[typeof admin, typeof customer]>
    cleanup: CleanupFunction
  }>({
    factories: {
      generate: {
        cart: generateCart,
        customer: generateCustomer,
        user: generateUser,
        product: generateProduct,
        productImage: generateProductImage,
        productVariant: generateProductVariant,
        productVariantImage: generateProductVariantImage,
        productOption: generateProductOption,
        productOptionValue: generateProductOptionValue,
        productProductOption: generateProductProductOption,
        productProductOptionValue: generateProductProductOptionValue,
        productVariantOption: generateProductVariantOption,
        priceSet: generatePriceSet,
        price: generatePrice,
        productVariantPriceSet: generateProductVariantPriceSet,
        fulfillmentProvider: generateFulfillmentProvider,
        fulfillmentSet: generateFulfillmentSet,
        serviceZone: generateServiceZone,
        geoZone: generateGeoZone,
        shippingProfile: generateShippingProfile,
        shippingOptionType: generateShippingOptionType,
        shippingOption: generateShippingOption,
        paymentProvider: generatePaymentProvider,

        // Forms
        loginForm: generateLoginFormValues,
        customerSignupForm: generateRegisterFormValues,
      },
      read: {
        customer: retrieveCustomer,
        notification: retrieveNotification,
      },
      create: {
        cart: createCart,
        customer: createCustomer,
        user: createUser,
        product: createProduct,
        productImage: createProductImage,
        productVariant: createProductVariant,
        productVariantImage: createProductVariantImage,
        productOption: createProductOption,
        productOptionValue: createProductOptionValue,
        productProductOption: createProductProductOption,
        productProductOptionValue: createProductProductOptionValue,
        productVariantOption: createProductVariantOption,
        priceSet: createPriceSet,
        price: createPrice,
        productVariantPriceSet: createProductVariantPriceSet,
        productWithOption: createProductWithOption,
        productWithPricing: createProductWithPricing,
        shippingOptionWithZone: createShippingOptionWithZone,
        fulfillmentProvider: createFulfillmentProvider,
        fulfillmentSet: createFulfillmentSet,
        serviceZone: createServiceZone,
        geoZone: createGeoZone,
        shippingProfile: createShippingProfile,
        shippingOptionType: createShippingOptionType,
        shippingOption: createShippingOption,
        paymentProvider: createPaymentProvider,
      },
      destroy: {
        cart: deleteCartById,
        notification: deleteNotificationsByIds,
        customer: deleteCustomerById,
        user: deleteUserById,
        product: deleteProductById,
        productImage: deleteProductImageById,
        productVariantImage: deleteProductVariantImageById,
        productOption: deleteProductOptionById,
        productOptionValue: deleteProductOptionValueById,
        productProductOption: deleteProductProductOptionById,
        productProductOptionValue: deleteProductProductOptionValueById,
        productVariantOption: deleteProductVariantOptionById,
        priceSet: deletePriceSetById,
        price: deletePriceById,
        productVariantPriceSet: deleteProductVariantPriceSetById,
        fulfillmentProvider: deleteFulfillmentProviderById,
        fulfillmentSet: deleteFulfillmentSetById,
        serviceZone: deleteServiceZoneById,
        geoZone: deleteGeoZoneById,
        shippingProfile: deleteShippingProfileById,
        shippingOptionType: deleteShippingOptionTypeById,
        shippingOption: deleteShippingOptionById,
        paymentProvider: deletePaymentProviderById,
      },
    },

    navigate: async ({ page }, use) => {
      const navigate: NavigateFunction<RoutePath> = async ({ to, params, search }) => {
        const { interpolatedPath } = interpolatePath({ path: to, params: params ?? {} })
        const query = new URLSearchParams(search).toString()
        await page.goto(query ? `${interpolatedPath}?${query}` : interpolatedPath, { waitUntil: 'networkidle' })
      }
      await use(navigate)
    },

    authenticate: combinePersonas(admin, customer),

    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires object destructuring for fixture args
    cleanup: async ({}, use) => {
      const callbacks: Array<() => Promise<void>> = []
      await use({
        add: (fn: () => Promise<void>) => {
          callbacks.push(fn)
        },
      })
      for (const fn of callbacks.reverse()) {
        await fn()
      }
    },
  })

  return { test, expect }
}

export { expect }
