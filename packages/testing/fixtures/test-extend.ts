import { test as base, expect } from '@playwright/test'
import { interpolatePath } from '@tanstack/react-router'
import {
  createCart,
  createCheckoutInfrastructure,
  createCustomer,
  createFulfillmentProvider,
  createFulfillmentSet,
  createGeoZone,
  createPaymentProvider,
  createPrice,
  createPriceSet,
  createProduct,
  createProductImage,
  createProductVariant,
  createProductVariantImage,
  createProductVariantPriceSet,
  createProductWithPricing,
  createServiceZone,
  createShippingInfrastructure,
  createShippingOption,
  createShippingOptionType,
  createShippingProfile,
  createUser,
  deleteCartById,
  deleteCustomerById,
  deleteFulfillmentProviderById,
  deleteFulfillmentSetById,
  deleteGeoZoneById,
  deletePaymentProviderById,
  deletePriceById,
  deletePriceSetById,
  deleteProductById,
  deleteProductImageById,
  deleteProductVariantImageById,
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
  generateProductVariant,
  generateProductVariantImage,
  generateProductVariantPriceSet,
  generateServiceZone,
  generateShippingOption,
  generateShippingOptionType,
  generateShippingProfile,
  generateUser,
} from 'backend/test'
import { type AuthenticateFunction, combinePersonas, definePersona } from 'playwright-persona'
import { generateLoginFormValues, generateRegisterFormValues } from '../factories/form-values.js'

type NavigateOptions<RoutePath extends string> = {
  to: RoutePath
  params?: Record<string, string>
  search?: Record<string, string>
}

type NavigateFunction<RoutePath extends string> = (options: NavigateOptions<RoutePath>) => Promise<void>

type CleanupFunction = {
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
    await expect(page.getByRole('button', { name: session.email })).toBeVisible({
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
  create: {
    cart: typeof createCart
    customer: typeof createCustomer
    user: typeof createUser
    product: typeof createProduct
    productImage: typeof createProductImage
    productVariant: typeof createProductVariant
    productVariantImage: typeof createProductVariantImage
    priceSet: typeof createPriceSet
    price: typeof createPrice
    productVariantPriceSet: typeof createProductVariantPriceSet
    productWithPricing: typeof createProductWithPricing
    checkoutInfrastructure: typeof createCheckoutInfrastructure
    shippingInfrastructure: typeof createShippingInfrastructure
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
    customer: typeof deleteCustomerById
    user: typeof deleteUserById
    product: typeof deleteProductById
    productImage: typeof deleteProductImageById
    productVariantImage: typeof deleteProductVariantImageById
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
      create: {
        cart: createCart,
        customer: createCustomer,
        user: createUser,
        product: createProduct,
        productImage: createProductImage,
        productVariant: createProductVariant,
        productVariantImage: createProductVariantImage,
        priceSet: createPriceSet,
        price: createPrice,
        productVariantPriceSet: createProductVariantPriceSet,
        productWithPricing: createProductWithPricing,
        checkoutInfrastructure: createCheckoutInfrastructure,
        shippingInfrastructure: createShippingInfrastructure,
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
        customer: deleteCustomerById,
        user: deleteUserById,
        product: deleteProductById,
        productImage: deleteProductImageById,
        productVariantImage: deleteProductVariantImageById,
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
