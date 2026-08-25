import { expect, test } from '../setup/test-extend.js'

test.describe('Account', () => {
  test('a customer with no orders gets the empty panel and a way out of it', async ({
    page,
    authenticate,
    navigate,
  }) => {
    const session = await authenticate({ as: 'customer' })
    await navigate({ to: '/account' })

    await expect(page.getByRole('heading', { name: /hello/i })).toBeVisible()
    await expect(page.getByText(/you haven't made any orders yet/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /shop all products/i })).toBeVisible()

    // Details is read-only, so the email is the only claim the panel makes worth asserting.
    await expect(page.getByText(session.email).first()).toBeVisible()
  })
})
