import { expect, test } from '../setup/test-extend.js'

test.describe('Auth', () => {
  test('login with valid credentials', async ({ page, navigate, factories }) => {
    await using user = await factories.create.user()

    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL('/', { timeout: 15000 })
  })

  test('login with invalid credentials', async ({ page, navigate, factories }) => {
    const credentials = factories.generate.loginForm()

    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByLabel('Password').fill(credentials.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/login failed/i)).toBeVisible()
  })

  test('logout', async ({ page, authenticate }) => {
    await authenticate({ as: 'admin' })

    await page.locator('[data-slot="dropdown-menu-trigger"]').click()
    await page.getByRole('menuitem', { name: /log out/i }).click()

    await expect(page).toHaveURL('/login')
  })

  test('unauthenticated access redirects to login', async ({ page, navigate }) => {
    await navigate({ to: '/' })
    await expect(page).toHaveURL('/login')

    await navigate({ to: '/products' })
    await expect(page).toHaveURL('/login')
  })
})
