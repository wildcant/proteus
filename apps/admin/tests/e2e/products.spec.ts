import { deleteProductById } from 'backend/test'
import { expect, test } from '../setup/test-extend.js'
import { imageFile } from '../setup/utils.js'

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

test('product media section selects and deletes media', async ({ page, authenticate, navigate, factories }) => {
  // The factory gives the product a thumbnail but no image rows, so the grid renders the
  // thumbnail-only fallback — the one piece of media that exists outside the images collection.
  await using product = await factories.create.product({
    status: 'published',
    thumbnail: 'https://example.com/thumbnail.png',
  })
  await authenticate({ as: 'admin' })

  await navigate({ to: '/products/$id', params: { id: product.id } })

  const mediaSection = page.locator('[data-slot="card"]').filter({ has: page.getByText('Media', { exact: true }) })
  const thumbnail = mediaSection.getByRole('img', { name: `${product.title} media` })
  await expect(thumbnail).toBeVisible()

  // Selecting media reveals the command bar
  await thumbnail.hover()
  await mediaSection.getByRole('checkbox', { name: 'Select image' }).click()
  await expect(page.getByText('1 selected')).toBeVisible()

  await page.locator('[data-slot="command-bar-command"]', { hasText: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(mediaSection.getByText('No media')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('1 selected')).not.toBeVisible()
})

test('edit media modal uploads, promotes a thumbnail and deletes', async ({
  page,
  authenticate,
  navigate,
  factories,
}) => {
  await using product = await factories.create.product({ status: 'published', thumbnail: null })
  await authenticate({ as: 'admin' })

  await navigate({ to: '/products/$id/media', params: { id: product.id } })

  const modal = page.getByRole('dialog').last()
  const tiles = modal.locator('[data-slot="media-tile"]')

  // Dropping files only stages them locally — nothing is uploaded until the form is submitted
  await modal
    .locator('input[type="file"]')
    .setInputFiles([imageFile('first.png'), imageFile('second.avif', 'image/avif')])
  await expect(tiles).toHaveCount(2)

  // Promote the second image to thumbnail
  await tiles.nth(1).hover()
  await tiles.nth(1).getByRole('checkbox', { name: 'Select image' }).click()
  await page.locator('[data-slot="command-bar-command"]', { hasText: 'Make thumbnail' }).click()
  await expect(tiles.nth(1).getByRole('button', { name: 'Thumbnail' })).toBeVisible()

  await modal.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Media updated successfully')).toBeVisible({ timeout: 10000 })

  // Both images round-tripped through storage and are back on the detail page
  const mediaSection = page.locator('[data-slot="card"]').filter({ has: page.getByText('Media', { exact: true }) })
  const images = mediaSection.getByRole('img', { name: `${product.title} media` })
  await expect(images).toHaveCount(2)
  await expect(images.first()).toHaveAttribute('src', /\/static\//)

  // The badge sits on the image that was promoted, not on whichever one happens to be first
  const detailTiles = mediaSection.locator('[data-slot="media-tile"]')
  await expect(detailTiles.nth(1).getByRole('button', { name: 'Thumbnail' })).toBeVisible()
  await expect(mediaSection.getByRole('button', { name: 'Thumbnail' })).toHaveCount(1)

  // Deleting one image leaves the other behind
  await images.first().hover()
  await mediaSection.getByRole('checkbox', { name: 'Select image' }).first().click()
  await page.locator('[data-slot="command-bar-command"]', { hasText: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(images).toHaveCount(1, { timeout: 10000 })
})

test('product create form uploads staged media', async ({ page, authenticate, navigate, cleanup }) => {
  await authenticate({ as: 'admin' })
  await navigate({ to: '/products/create' })

  const modal = page.getByRole('dialog').last()
  const title = `E2E Media Product ${Date.now()}`
  await modal.getByLabel('Title', { exact: true }).fill(title)
  await modal.getByLabel('Handle').fill(`e2e-media-product-${Date.now()}`)

  await modal.locator('input[type="file"]').setInputFiles([imageFile('staged.png'), imageFile('other.png')])
  const rows = modal.locator('[data-slot="media-row"]')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('staged.png')

  // Promote the second file so the created product does not just default to the first image
  await rows.nth(1).locator('[data-slot="dropdown-menu-trigger"]').click()
  await page.getByRole('menuitem', { name: 'Make thumbnail' }).click()

  await modal.getByRole('button', { name: 'Save as Draft' }).click()
  await expect(page.getByText('Product created successfully')).toBeVisible({ timeout: 10000 })
  await page.waitForURL(/\/products\/prod_/, { timeout: 10000 })

  const productId = page.url().split('/products/')[1]?.split('/')[0]
  if (productId) cleanup.add(() => deleteProductById(productId))

  const mediaSection = page.locator('[data-slot="card"]').filter({ has: page.getByText('Media', { exact: true }) })
  const images = mediaSection.getByRole('img', { name: `${title} media` })
  await expect(images).toHaveCount(2)
  await expect(images.first()).toHaveAttribute('src', /\/static\//)

  // The badge sits on the file that was promoted, not on whichever one happens to be first
  const tiles = mediaSection.locator('[data-slot="media-tile"]')
  await expect(tiles.nth(1).getByRole('button', { name: 'Thumbnail' })).toBeVisible()
  await expect(mediaSection.getByRole('button', { name: 'Thumbnail' })).toHaveCount(1)
})
