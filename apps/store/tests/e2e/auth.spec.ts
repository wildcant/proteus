import { BACKEND_TIMEOUT, pollDatabase } from '@proteus/testing'
import { NotificationTemplates } from 'backend/test'
import { expect, test } from '../setup/test-extend.js'

// Signup and verification each span a backend round trip plus email dispatch, and the
// first run after globalSetup pays for a DB migration and a cold Vite compile on top.
test.describe.configure({ timeout: 60_000 })

test.describe('Auth', () => {
  test('signs up, verifies from the emailed link, then signs in', async ({ page, navigate, factories, cleanup }) => {
    const registration = factories.generate.customerSignupForm()
    cleanup.add(async () => {
      const customer = await factories.read.customer({ email: registration.email })
      if (customer) await factories.destroy.customer(customer.id)
    })

    await navigate({ to: '/signup' })

    // Submitting empty surfaces field errors and stays put.
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByText(/invalid email address/i)).toBeVisible()
    await expect(page.getByText(/enter a password/i)).toBeVisible()
    await expect(page).toHaveURL(/\/signup/)

    await page.getByRole('textbox', { name: 'First name' }).fill(registration.firstName)
    await page.getByRole('textbox', { name: 'Last name' }).fill(registration.lastName)
    await page.getByRole('textbox', { name: 'Email' }).fill(registration.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(registration.password)
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: BACKEND_TIMEOUT })

    const notification = await pollDatabase(
      () => factories.read.notification({ to: registration.email, template: NotificationTemplates.VERIFY_EMAIL }),
      `No verify-email notification was sent to ${registration.email}`,
    )
    cleanup.add(() => factories.destroy.notification([notification.id]))

    const { verifyLink } = notification.data ?? {}
    const code = typeof verifyLink === 'string' ? new URL(verifyLink).searchParams.get('code') : null
    expect(code, `verifyLink had no code: ${verifyLink}`).not.toBeNull()

    await navigate({ to: '/verify', search: { code: code as string } })
    await expect(page.getByRole('heading', { name: /email verified/i })).toBeVisible({ timeout: BACKEND_TIMEOUT })

    await page.getByRole('link', { name: /^sign in$/i }).click()
    await expect(page).toHaveURL('/login')

    await page.getByRole('textbox', { name: 'Email' }).fill(registration.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(registration.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL('/account', { timeout: BACKEND_TIMEOUT })
  })

  test('signing in before verifying returns to the check your email step', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    const registration = factories.generate.customerSignupForm()
    // No customer row to destroy: it is written on the post-verification login, which this
    // test stops short of. The auth identity has no customerId to delete by, so globalSetup
    // truncation clears it.

    await navigate({ to: '/signup' })
    await page.getByRole('textbox', { name: 'First name' }).fill(registration.firstName)
    await page.getByRole('textbox', { name: 'Last name' }).fill(registration.lastName)
    await page.getByRole('textbox', { name: 'Email' }).fill(registration.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(registration.password)
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: BACKEND_TIMEOUT })

    const signupEmail = await pollDatabase(
      () => factories.read.notification({ to: registration.email, template: NotificationTemplates.VERIFY_EMAIL }),
      `No verify-email notification was sent to ${registration.email}`,
    )

    // Same credentials, no verification in between.
    await navigate({ to: '/login' })
    await page.getByRole('textbox', { name: 'Email' }).fill(registration.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(registration.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: BACKEND_TIMEOUT })
    await expect(page).not.toHaveURL('/account')

    // The sign-in attempt sends a fresh link rather than reusing the signup one.
    const resent = await pollDatabase(async () => {
      const latest = await factories.read.notification({
        to: registration.email,
        template: NotificationTemplates.VERIFY_EMAIL,
      })
      return latest && latest.id !== signupEmail.id ? latest : null
    }, `Signing in unverified did not send a new verify-email to ${registration.email}`)
    cleanup.add(() => factories.destroy.notification([signupEmail.id, resent.id]))
  })

  test('login with invalid credentials', async ({ page, navigate, factories }) => {
    const credentials = factories.generate.loginForm()

    await navigate({ to: '/login' })
    await page.getByRole('textbox', { name: 'Email' }).fill(credentials.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(credentials.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page.getByText(/invalid email or password/i).first()).toBeVisible()
  })

  test('unauthenticated access redirects to login', async ({ page, navigate }) => {
    await navigate({ to: '/account' })
    await expect(page).toHaveURL('/login')
  })
})
