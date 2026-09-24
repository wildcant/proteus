import { expect, test } from '../setup/test-extend.js'

/**
 * A staff member's own Locale decides the admin's language. The sign-in page follows the browser
 * (English here); once signed in, the admin reloads into the staff member's Locale, and picking a
 * language in the account menu saves it and reloads into that one.
 */
test('a Spanish-language staff member works in Spanish and switches back to English', async ({
  page,
  navigate,
  factories,
}) => {
  await using role = await factories.create.role({ name: `Spanish staff ${Date.now()}`, featuresJson: ['*'] })
  await using staff = await factories.create.user({ locale: 'es-CO' })
  await using _assignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: staff.id,
    roleId: role.id,
  })

  await navigate({ to: '/login' })
  await page.getByLabel('Email').fill(staff.email)
  await page.getByLabel('Password').fill(staff.password)
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page.getByRole('link', { name: 'Pedidos' })).toBeVisible({ timeout: 15_000 })

  await navigate({ to: '/products' })
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Crear producto' })).toBeVisible()

  // Permission titles come from the backend in English; the admin names them by key. The key stays.
  await navigate({ to: '/settings/roles/create' })
  await expect(page.getByLabel('Ver pedidos')).toBeVisible()
  await expect(page.getByLabel('Reenviar invitaciones')).toBeVisible()
  await expect(page.getByText('order.read', { exact: true })).toBeVisible()

  // Named in the language the admin renders in now: Spanish names English "inglés".
  await page.getByRole('button', { name: staff.name }).click()
  await page.getByRole('menuitem', { name: 'Idioma' }).click()
  await page.getByRole('menuitemradio', { name: /inglés/i }).click()

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible()
})
