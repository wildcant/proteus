import { expect, test } from '../setup/test-extend.js'

// Applying a structure file deletes every metafield definition, Category and Collection it leaves out,
// store-wide. Specs run
// fully parallel against one database, so this journey can delete groupings another spec is using.
// Run it on its own (`pnpm --filter admin run test:e2e catalog-structure`) until it gets a database
// of its own.
test('structure import journey: upload, preview the changes and the menu, apply', async ({
  page,
  authenticate,
  navigate,
  factories,
  cleanup,
}) => {
  await authenticate({ as: 'admin' })
  const suffix = Date.now()
  const parentName = `E2E Structure ${suffix}`
  const childName = `E2E Structure Child ${suffix}`
  const metafieldName = `E2E Field ${suffix}`
  const metafieldKey = `e2e_${suffix}`
  const yaml = [
    'campos:',
    `  - nombre: ${metafieldName}`,
    `    clave: ${metafieldKey}`,
    'categorias:',
    `  - nombre: ${parentName}`,
    `    handle: e2e-structure-${suffix}`,
    `    regla: { ${metafieldKey}: [structure] }`,
    '    hijos:',
    `      - nombre: ${childName}`,
    `        handle: e2e-structure-child-${suffix}`,
    'menu:',
    `  - categoria: e2e-structure-${suffix}`,
    '',
  ].join('\n')

  await navigate({ to: '/products' })
  await page.getByRole('link', { name: 'Import structure' }).click()

  const modal = page.getByRole('dialog').last()
  await expect(modal.getByText('Categories, collections and menu from a YAML file')).toBeVisible()

  // A broken file stays on upload, every error listed by where it is in the file.
  await modal.locator('input[type="file"]').setInputFiles({
    name: 'estructura.yaml',
    mimeType: 'application/yaml',
    buffer: Buffer.from('menu:\n  - categoria: nada\n'),
  })
  await modal.getByRole('button', { name: 'Upload file' }).click()
  await expect(modal.getByText('The structure file has errors.', { exact: false })).toBeVisible({ timeout: 15000 })
  await expect(modal.getByText('menu[0].categoria')).toBeVisible()

  await modal.getByRole('button', { name: 'Replace file' }).click()
  await modal
    .locator('input[type="file"]')
    .setInputFiles({ name: 'estructura.yaml', mimeType: 'application/yaml', buffer: Buffer.from(yaml) })
  await modal.getByRole('button', { name: 'Upload file' }).click()

  // Preview — the metafield and both categories are new, and the menu after holds the parent.
  await expect(modal.getByText('Preview the structure')).toBeVisible({ timeout: 15000 })
  const createdMetafields = modal.locator('section').filter({ hasText: 'Metafields to create' })
  await expect(createdMetafields.getByText(metafieldName, { exact: true })).toBeVisible()
  const created = modal.locator('section').filter({ hasText: 'Categories to create' })
  await expect(created.getByText(parentName, { exact: true })).toBeVisible()
  await expect(created.getByText(childName, { exact: true })).toBeVisible()
  await expect(modal.getByText(`e2e-structure-${suffix}`, { exact: true }).last()).toBeVisible()
  await modal.getByRole('button', { name: 'Apply structure' }).click()

  await expect(page.getByText('Structure applied')).toBeVisible({ timeout: 15000 })
  await expect(modal).toBeHidden()

  // The tree is the file's: the child sits under the parent.
  await navigate({ to: '/categories' })
  const parentLink = page.getByRole('link', { name: new RegExp(parentName) }).first()
  await expect(parentLink).toBeVisible()
  const childLink = page.getByRole('link', { name: new RegExp(childName) }).first()
  await expect(childLink).toBeVisible()
  // Cleanups run last-added first and `parent_id` restricts the parent's delete, so the parent goes first here.
  for (const link of [parentLink, childLink]) {
    const categoryId = (await link.getAttribute('href'))?.match(/pcat_[a-z0-9]+/)?.[0]
    if (categoryId) cleanup.add(() => factories.destroy.productCategory(categoryId))
  }
  await childLink.click()
  await page.waitForURL(/\/categories\/pcat_/)
  await expect(page.getByText(parentName, { exact: true })).toBeVisible()
})
