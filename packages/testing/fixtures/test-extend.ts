import type { Response } from '@playwright/test'
import { test as base, expect } from '@playwright/test'
import { interpolatePath } from '@tanstack/react-router'
import {
  createActorRoleAssignment,
  createCart,
  createCustomer,
  createCustomerAddress,
  createFulfillmentProvider,
  createFulfillmentSet,
  createGeoZone,
  createInventoryItem,
  createInventoryLevel,
  createOrder,
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
  createProductVariantInventoryItem,
  createProductVariantOption,
  createProductVariantPriceSet,
  createProductWithOption,
  createProductWithPricing,
  createReservationItem,
  createRole,
  createServiceZone,
  createShippingOption,
  createShippingOptionType,
  createShippingOptionWithZone,
  createShippingProfile,
  createStockLocation,
  createUser,
  deleteActorRoleAssignmentById,
  deleteCartById,
  deleteCustomerAddressById,
  deleteCustomerById,
  deleteFulfillmentProviderById,
  deleteFulfillmentSetById,
  deleteGeoZoneById,
  deleteNotificationsByIds,
  deleteOrderById,
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
  deleteRoleById,
  deleteServiceZoneById,
  deleteShippingOptionById,
  deleteShippingOptionTypeById,
  deleteShippingProfileById,
  deleteStockLocationById,
  deleteUserById,
  generateActorRoleAssignment,
  generateCart,
  generateCustomer,
  generateCustomerAddress,
  generateFulfillmentProvider,
  generateFulfillmentSet,
  generateGeoZone,
  generateOrder,
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
  generateRole,
  generateServiceZone,
  generateShippingOption,
  generateShippingOptionType,
  generateShippingProfile,
  generateStockLocation,
  generateUser,
  retrieveCustomer,
  retrieveNotification,
} from 'backend/test'
import { type AuthenticateFunction, combinePersonas, definePersona } from 'playwright-persona'
import { generateLoginFormValues, generateRegisterFormValues } from '../factories/form-values.js'
import { type ConsoleWatch, watchConsole } from './console-guard.js'
import { gotoSettled } from './navigation.js'

type NavigateOptions<RoutePath extends string> = {
  to: RoutePath
  params?: Record<string, string>
  search?: Record<string, string>
}

type NavigateFunction<RoutePath extends string> = (options: NavigateOptions<RoutePath>) => Promise<void>

/** A raw URL, for the addresses a typed route cannot express. See the `goto` fixture. */
type GotoFunction = (url: string) => Promise<Response | null>

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
    await gotoSettled(page, '/')
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
    // Prefixed: this persona drives the storefront, where every URL carries its market, and
    // `en-US` is the market a browser with no cookie lands in. The admin persona above is a
    // different application and stays unprefixed.
    await page.waitForURL('/en-US/account')
    return { customerId: customer.id, email: customer.email }
  },
  async verifySession({ page, session }) {
    await gotoSettled(page, '/account')
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
    actorRoleAssignment: typeof generateActorRoleAssignment
    cart: typeof generateCart
    customer: typeof generateCustomer
    customerAddress: typeof generateCustomerAddress
    role: typeof generateRole
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
    stockLocation: typeof generateStockLocation
    shippingOptionType: typeof generateShippingOptionType
    shippingOption: typeof generateShippingOption
    paymentProvider: typeof generatePaymentProvider
    order: typeof generateOrder
    loginForm: typeof generateLoginFormValues
    customerSignupForm: typeof generateRegisterFormValues
  }
  read: {
    customer: typeof retrieveCustomer
    notification: typeof retrieveNotification
  }
  create: {
    actorRoleAssignment: typeof createActorRoleAssignment
    cart: typeof createCart
    customer: typeof createCustomer
    customerAddress: typeof createCustomerAddress
    role: typeof createRole
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
    stockLocation: typeof createStockLocation
    inventoryItem: typeof createInventoryItem
    inventoryLevel: typeof createInventoryLevel
    productVariantInventoryItem: typeof createProductVariantInventoryItem
    reservationItem: typeof createReservationItem
    shippingOptionType: typeof createShippingOptionType
    shippingOption: typeof createShippingOption
    paymentProvider: typeof createPaymentProvider
    order: typeof createOrder
  }
  destroy: {
    actorRoleAssignment: typeof deleteActorRoleAssignmentById
    cart: typeof deleteCartById
    notification: typeof deleteNotificationsByIds
    customer: typeof deleteCustomerById
    customerAddress: typeof deleteCustomerAddressById
    role: typeof deleteRoleById
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
    stockLocation: typeof deleteStockLocationById
    shippingOptionType: typeof deleteShippingOptionTypeById
    shippingOption: typeof deleteShippingOptionById
    paymentProvider: typeof deletePaymentProviderById
    order: typeof deleteOrderById
  }
}

export function createTest<RoutePath extends string = string>() {
  const test = base.extend<{
    factories: Factories
    navigate: NavigateFunction<RoutePath>
    goto: GotoFunction
    authenticate: AuthenticateFunction<[typeof admin, typeof customer]>
    cleanup: CleanupFunction
    consoleGuard: ConsoleWatch
    seededImages: undefined
  }>({
    factories: {
      generate: {
        actorRoleAssignment: generateActorRoleAssignment,
        cart: generateCart,
        customer: generateCustomer,
        customerAddress: generateCustomerAddress,
        role: generateRole,
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
        stockLocation: generateStockLocation,
        shippingOptionType: generateShippingOptionType,
        shippingOption: generateShippingOption,
        paymentProvider: generatePaymentProvider,
        order: generateOrder,

        // Forms
        loginForm: generateLoginFormValues,
        customerSignupForm: generateRegisterFormValues,
      },
      read: {
        customer: retrieveCustomer,
        notification: retrieveNotification,
      },
      create: {
        actorRoleAssignment: createActorRoleAssignment,
        cart: createCart,
        customer: createCustomer,
        customerAddress: createCustomerAddress,
        role: createRole,
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
        stockLocation: createStockLocation,
        inventoryItem: createInventoryItem,
        inventoryLevel: createInventoryLevel,
        productVariantInventoryItem: createProductVariantInventoryItem,
        reservationItem: createReservationItem,
        shippingOptionType: createShippingOptionType,
        shippingOption: createShippingOption,
        paymentProvider: createPaymentProvider,
        order: createOrder,
      },
      destroy: {
        actorRoleAssignment: deleteActorRoleAssignmentById,
        cart: deleteCartById,
        notification: deleteNotificationsByIds,
        customer: deleteCustomerById,
        customerAddress: deleteCustomerAddressById,
        role: deleteRoleById,
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
        stockLocation: deleteStockLocationById,
        shippingOptionType: deleteShippingOptionTypeById,
        shippingOption: deleteShippingOptionById,
        paymentProvider: deletePaymentProviderById,
        order: deleteOrderById,
      },
    },

    /**
     * Every spec in both suites, without opting in: a React key warning or a Base UI semantics
     * warning is a defect on whatever screen the test just walked through, and the console is the
     * only place either one is reported. `auto` is what makes this a gate rather than a helper —
     * a guard nobody remembers to add is not one.
     */
    consoleGuard: [
      async ({ page }, use) => {
        const guard = watchConsole(page)
        await use(guard)
        expect(guard.complaints(), 'the page logged warnings — see packages/testing/fixtures/console-guard.ts').toEqual(
          [],
        )
      },
      { auto: true },
    ],

    /**
     * Answers `cdn.test` — the host every seeded image is on (`factories/image-url.ts`) — with one
     * transparent pixel.
     *
     * It is the whole of what keeps a run off the public internet. Left unanswered, a reserved
     * `.test` host fails DNS and the browser logs that at `error` level for the guard above, and a
     * real host is worse: `waitUntil: 'networkidle'` waits on every photo in a product grid, so a
     * slow CDN is a 30-second timeout on a test about the market cookie.
     *
     * Nothing asserts on the pixels — the claim is always about `src` — so one response serves
     * every image. On the context rather than the page, so a spec's second tab is covered too.
     */
    seededImages: [
      async ({ page }, use) => {
        const pixel = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        )
        await page
          .context()
          .route('https://cdn.test/**', (route) =>
            route.fulfill({ status: 200, contentType: 'image/png', body: pixel }),
          )
        await use(undefined)
      },
      { auto: true },
    ],

    navigate: async ({ page }, use) => {
      const navigate: NavigateFunction<RoutePath> = async ({ to, params, search }) => {
        const { interpolatedPath } = interpolatePath({ path: to, params: params ?? {} })
        const query = new URLSearchParams(search).toString()
        await gotoSettled(page, query ? `${interpolatedPath}?${query}` : interpolatedPath)
      }
      await use(navigate)
    },

    /**
     * The addresses `navigate` cannot express: a market-prefixed path, which the route tree does
     * not carry (see the rewrite in the store's router), and the bare root, which is not a page at
     * all but the address the market middleware answers with a redirect. Both settle the same way
     * a typed navigation does, so a spec never chooses a waiting strategy.
     */
    goto: async ({ page }, use) => {
      await use((url: string) => gotoSettled(page, url))
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
