import { deleteProductById } from 'backend/test'
import { expect, test } from '../setup/test-extend.js'

test('product CRUD journey', async ({ page, authenticate, navigate, factories, cleanup }) => {
  await using product = await factories.create.product({ status: 'published' })
  await using variant = await factories.create.productVariant({ productId: product.id })
  await authenticate({ as: 'admin' })

  // List — seeded product appears in the table
  await navigate({ to: '/products' })
  await expect(page.getByRole('cell', { name: product.title })).toBeVisible()

  // Create — fill form, save as draft, verify toast + redirect
  await page.getByRole('link', { name: 'Create Product' }).click()
  const title = `E2E Product ${Date.now()}`
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByLabel('Handle').fill(`e2e-product-${Date.now()}`)
  await page.getByRole('button', { name: 'Save as Draft' }).click()
  await expect(page.getByText('Product created successfully')).toBeVisible({ timeout: 10000 })
  await page.waitForURL(/\/products\/prod_/, { timeout: 10000 })
  const createdProductId = page.url().split('/products/')[1]?.split('/')[0]
  if (createdProductId) cleanup.add(() => deleteProductById(createdProductId))

  // Detail — go back to list, click seeded product row, verify title + handle
  await page.locator('[data-slot="sidebar-menu-button"]', { hasText: 'Products' }).click()
  await expect(page.getByRole('cell', { name: product.title })).toBeVisible()
  await page.getByRole('cell', { name: product.title }).click()
  await expect(page).toHaveURL(new RegExp(`/products/${product.id}`))
  await expect(page.getByText(product.title).first()).toBeVisible()
  await expect(page.getByText(`/${product.handle}`)).toBeVisible()

  // Variant navigation — click variant row, verify variant page loads
  await expect(page.getByRole('cell', { name: variant.title })).toBeVisible()
  await page.getByRole('cell', { name: variant.title }).click()
  await expect(page).toHaveURL(new RegExp(`/products/${product.id}/variants/${variant.id}`))
  await expect(page.getByText(variant.title).first()).toBeVisible()

  // Update — open edit drawer, change title, save
  await navigate({ to: '/products/$id/edit', params: { id: product.id } })
  const updatedTitle = `Updated ${product.title}`
  const editDrawer = page.locator('[role="dialog"]').last()
  await editDrawer.locator('input[placeholder="Product title"]').fill(updatedTitle)
  await editDrawer.locator('button', { hasText: 'Save' }).click()
  const generalSection = page.locator('[data-slot="card"]').first()
  await expect(generalSection.getByText(updatedTitle)).toBeVisible({ timeout: 10000 })

  // Delete — open action menu, delete product, verify redirect to list
  await generalSection.locator('[data-slot="dropdown-menu-trigger"]').click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('cell', { name: updatedTitle })).not.toBeVisible()
})
