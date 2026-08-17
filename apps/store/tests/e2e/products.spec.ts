import { faker } from '@faker-js/faker'
import { expect, test } from '../setup/test-extend.js'

test.describe('Products', () => {
  test('product list page shows seeded products', async ({ page, authenticate, navigate, factories }) => {
    await using product = await factories.create.product({ status: 'published' })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/products' })

    await expect(page.getByText(product.title)).toBeVisible()
  })

  test('product detail page shows product info', async ({ page, authenticate, navigate, factories }) => {
    const description = faker.commerce.productDescription()
    await using product = await factories.create.product({ status: 'published', description })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })

    await expect(page.getByRole('heading', { name: product.title })).toBeVisible()
    if (!product.description) throw new Error('Seeded product is missing a description')
    await expect(page.getByText(product.description)).toBeVisible()
  })
})
