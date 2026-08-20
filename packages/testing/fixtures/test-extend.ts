import { test as base, expect } from '@playwright/test'
import { interpolatePath } from '@tanstack/react-router'
import {
  createCart,
  createCustomer,
  createPrice,
  createPriceSet,
  createProduct,
  createProductVariant,
  createProductVariantPriceSet,
  createProductWithPricing,
  createUser,
  deleteCartById,
  deleteCustomerById,
  deletePriceById,
  deletePriceSetById,
  deleteProductById,
  deleteProductVariantPriceSetById,
  deleteUserById,
  generateCart,
  generateCustomer,
  generatePrice,
  generatePriceSet,
  generateProduct,
  generateProductVariant,
  generateProductVariantPriceSet,
  generateUser,
} from 'backend/test'
import { type AuthenticateFunction, combinePersonas, definePersona } from 'playwright-persona'
import { generateLoginFormValues, generateRegisterFormValues } from '../factories/form-values.js'

type NavigateOptions<RoutePath extends string> = {
  to: RoutePath
  params?: Record<string, string>
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

export function createTest<RoutePath extends string = string>() {
  const test = base.extend<{
    factories: {
      generate: {
        cart: typeof generateCart
        customer: typeof generateCustomer
        user: typeof generateUser
        product: typeof generateProduct
        productVariant: typeof generateProductVariant
        priceSet: typeof generatePriceSet
        price: typeof generatePrice
        productVariantPriceSet: typeof generateProductVariantPriceSet
        loginForm: typeof generateLoginFormValues
        customerSignupForm: typeof generateRegisterFormValues
      }
      create: {
        cart: typeof createCart
        customer: typeof createCustomer
        user: typeof createUser
        product: typeof createProduct
        productVariant: typeof createProductVariant
        priceSet: typeof createPriceSet
        price: typeof createPrice
        productVariantPriceSet: typeof createProductVariantPriceSet
        productWithPricing: typeof createProductWithPricing
      }
      destroy: {
        cart: typeof deleteCartById
        customer: typeof deleteCustomerById
        user: typeof deleteUserById
        product: typeof deleteProductById
        priceSet: typeof deletePriceSetById
        price: typeof deletePriceById
        productVariantPriceSet: typeof deleteProductVariantPriceSetById
      }
    }
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
        productVariant: generateProductVariant,
        priceSet: generatePriceSet,
        price: generatePrice,
        productVariantPriceSet: generateProductVariantPriceSet,

        // Forms
        loginForm: generateLoginFormValues,
        customerSignupForm: generateRegisterFormValues,
      },
      create: {
        cart: createCart,
        customer: createCustomer,
        user: createUser,
        product: createProduct,
        productVariant: createProductVariant,
        priceSet: createPriceSet,
        price: createPrice,
        productVariantPriceSet: createProductVariantPriceSet,
        productWithPricing: createProductWithPricing,
      },
      destroy: {
        cart: deleteCartById,
        customer: deleteCustomerById,
        user: deleteUserById,
        product: deleteProductById,
        priceSet: deletePriceSetById,
        price: deletePriceById,
        productVariantPriceSet: deleteProductVariantPriceSetById,
      },
    },

    navigate: async ({ page }, use) => {
      const navigate: NavigateFunction<RoutePath> = async ({ to, params }) => {
        const { interpolatedPath } = interpolatePath({ path: to, params: params ?? {} })
        await page.goto(interpolatedPath, { waitUntil: 'networkidle' })
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
