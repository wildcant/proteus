import { expect, test } from '../setup/test-extend.js'

test.describe('Auth', () => {
  test('login with valid credentials', async ({ page, navigate, factories }) => {
    await using customer = await factories.create.customer()

    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(customer.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL('/account', { timeout: 15000 })
  })

  test('login with invalid credentials', async ({ page, navigate, factories }) => {
    const credentials = factories.generate.loginForm()

    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(credentials.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/invalid email or password/i)).toBeVisible()
  })

  test('register new customer', async ({ page, navigate, factories }) => {
    const registration = factories.generate.customerSignupForm()

    await navigate({ to: '/login' })
    await page.getByRole('button', { name: /join us/i }).click()

    await page.getByLabel('First name').fill(registration.firstName)
    await page.getByLabel('Last name').fill(registration.lastName)
    await page.getByLabel('Email').fill(registration.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(registration.password)
    await page.getByRole('button', { name: /^join$/i }).click()

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 15000 })
  })

  test('forgot password', async ({ page, navigate, factories }) => {
    const credentials = factories.generate.loginForm()

    await navigate({ to: '/forgot-password' })
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByRole('button', { name: /send reset link/i }).click()

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: 15000 })
  })

  test('unauthenticated access redirects to login', async ({ page, navigate }) => {
    await navigate({ to: '/account' })
    await expect(page).toHaveURL('/login')
  })
})
