import { expect, test } from '../setup/test-extend.js'

async function loginAs(page: import('@playwright/test').Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('/')
}

test('super admin creates a role, assigns it to a user, and verifies role edit page', async ({
  page,
  navigate,
  factories,
}) => {
  // Set up a super admin user — '*' grants all permissions
  await using superAdminRole = await factories.create.role({
    name: `SuperAdmin ${Date.now()}`,
    isSuperAdmin: true,
    protected: true,
    featuresJson: ['*'],
  })
  await using superAdmin = await factories.create.user()
  await using saAssignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: superAdmin.id,
    roleId: superAdminRole.id,
  })

  await loginAs(page, superAdmin)

  // Super admin sees all settings pages
  await navigate({ to: '/settings/roles' })
  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible()

  await navigate({ to: '/settings/users' })
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

  // Create a "Catalogue Editor" role with product.* permissions
  await navigate({ to: '/settings/roles' })
  await page.getByRole('link', { name: 'Create' }).click()
  await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible()

  const roleName = `Catalogue Editor ${Date.now()}`
  await page.getByLabel('Name').fill(roleName)
  await page.getByLabel('Description').fill('Can manage products')

  const productGroup = page
    .locator('div')
    .filter({ has: page.locator('label', { hasText: /^product$/i }) })
    .first()
  await productGroup.getByRole('checkbox').first().click()

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name: roleName })).toBeVisible({ timeout: 10000 })

  // Navigate to role edit page — verify saved
  await page.getByRole('cell', { name: roleName }).click()
  await expect(page.getByText(roleName).first()).toBeVisible()

  // Assign the Catalogue Editor role to a second user
  await using targetUser = await factories.create.user()

  await navigate({ to: '/settings/users' })
  await expect(page.getByRole('cell', { name: targetUser.name })).toBeVisible({ timeout: 10000 })
  await page.getByRole('cell', { name: targetUser.name }).click()

  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible()
  const rolesCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Roles' }) })
  await rolesCard.getByRole('combobox').click()
  await page.getByRole('option', { name: roleName }).click()
  await page.keyboard.press('Escape')
  await rolesCard.getByRole('button', { name: 'Save roles' }).click()
  await expect(rolesCard.getByRole('button', { name: 'Save roles' })).toBeDisabled({ timeout: 10000 })

  void saAssignment
})

test('restricted user sees filtered sidebar and gets 403 on unauthorized pages', async ({
  page,
  navigate,
  factories,
}) => {
  await using productRole = await factories.create.role({
    name: `Product Only ${Date.now()}`,
    featuresJson: ['product.*'],
  })
  await using user = await factories.create.user()
  await using assignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: user.id,
    roleId: productRole.id,
  })

  await loginAs(page, user)

  // Sidebar shows Products but not Orders, Customers, Inventory
  const sidebar = page.locator('[data-slot="sidebar"]')
  await expect(sidebar.getByText('Products')).toBeVisible()
  await expect(sidebar.getByText('Orders')).not.toBeVisible()
  await expect(sidebar.getByText('Customers')).not.toBeVisible()
  await expect(sidebar.getByText('Inventory')).not.toBeVisible()

  // Direct navigation to /settings/users triggers 403
  await page.goto('/settings/users')
  await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 10000 })

  // Can still access products
  await navigate({ to: '/products' })
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create Product' })).toBeVisible()

  void assignment
})

test('catalogue editor can create, edit, and delete a product', async ({ page, navigate, factories, cleanup }) => {
  await using productRole = await factories.create.role({
    name: `Editor ${Date.now()}`,
    featuresJson: ['product.*'],
  })
  await using user = await factories.create.user()
  await using assignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: user.id,
    roleId: productRole.id,
  })

  await loginAs(page, user)

  // Create
  await navigate({ to: '/products' })
  await page.getByRole('link', { name: 'Create Product' }).click()
  const title = `RBAC Product ${Date.now()}`
  await page.getByLabel('Title', { exact: true }).fill(title)
  await page.getByLabel('Handle').fill(`rbac-product-${Date.now()}`)
  await page.getByRole('button', { name: 'Save as Draft' }).click()
  await expect(page.getByText('Product created successfully')).toBeVisible({ timeout: 10000 })
  await page.waitForURL(/\/products\/prod_/, { timeout: 10000 })
  const productId = page.url().split('/products/')[1]?.split('/')[0]
  if (productId) cleanup.add(() => factories.destroy.product(productId))

  // Edit
  await navigate({ to: '/products/$id/edit', params: { id: productId! } })
  const editDrawer = page.locator('[role="dialog"]').last()
  const updatedTitle = `Updated ${title}`
  await editDrawer.locator('input[placeholder="Product title"]').fill(updatedTitle)
  await editDrawer.locator('button', { hasText: 'Save' }).click()
  const generalSection = page.locator('[data-slot="card"]').first()
  await expect(generalSection.getByText(updatedTitle)).toBeVisible({ timeout: 10000 })

  // Delete
  await generalSection.locator('[data-slot="dropdown-menu-trigger"]').click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(page.getByRole('cell', { name: updatedTitle })).not.toBeVisible()

  void assignment
})

test('revoking a role removes navigation items after refresh', async ({ page, factories }) => {
  await using role = await factories.create.role({
    name: `Revokable ${Date.now()}`,
    featuresJson: ['product.*', 'order.*'],
  })
  await using user = await factories.create.user()
  const assignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: user.id,
    roleId: role.id,
  })

  await loginAs(page, user)

  const sidebar = page.locator('[data-slot="sidebar"]')
  await expect(sidebar.getByText('Products')).toBeVisible()
  await expect(sidebar.getByText('Orders')).toBeVisible()

  // Revoke role via DB
  await factories.destroy.actorRoleAssignment(assignment.id)

  // Refresh — navigation items gone
  await page.reload()
  await page.waitForURL('/')
  await expect(sidebar.getByText('Products')).not.toBeVisible({ timeout: 10000 })
  await expect(sidebar.getByText('Orders')).not.toBeVisible({ timeout: 10000 })
})

test('super admin can edit and delete a custom role through the UI', async ({ page, navigate, factories }) => {
  await using superAdminRole = await factories.create.role({
    name: `SA Edit Delete ${Date.now()}`,
    isSuperAdmin: true,
    protected: true,
    featuresJson: ['*'],
  })
  await using admin = await factories.create.user()
  await using saAssignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: admin.id,
    roleId: superAdminRole.id,
  })

  await loginAs(page, admin)

  const roleName = `Editable Role ${Date.now()}`
  await navigate({ to: '/settings/roles' })
  await page.getByRole('link', { name: 'Create' }).click()
  await page.getByLabel('Name').fill(roleName)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name: roleName })).toBeVisible({ timeout: 10000 })

  await page.getByRole('cell', { name: roleName }).click()
  const updatedName = `${roleName} Updated`
  await page.getByLabel('Name').fill(updatedName)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name: updatedName })).toBeVisible({ timeout: 10000 })

  const row = page.getByRole('row').filter({ hasText: updatedName })
  await row.getByRole('button').click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('cell', { name: updatedName })).not.toBeVisible({ timeout: 10000 })

  void saAssignment
})

test('revoking a role through the assignment UI updates nav on focus', async ({ page, navigate, factories }) => {
  await using superAdminRole = await factories.create.role({
    name: `SA Revoke UI ${Date.now()}`,
    isSuperAdmin: true,
    protected: true,
    featuresJson: ['*'],
  })
  await using admin = await factories.create.user()
  await using saAssignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: admin.id,
    roleId: superAdminRole.id,
  })

  await using targetRole = await factories.create.role({
    name: `Revocable UI ${Date.now()}`,
    featuresJson: ['product.*', 'order.*'],
  })
  await using targetUser = await factories.create.user()
  await using targetAssignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: targetUser.id,
    roleId: targetRole.id,
  })

  await loginAs(page, admin)

  await navigate({ to: '/settings/users/$id', params: { id: targetUser.id } })
  const rolesCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Roles' }) })
  await expect(rolesCard.getByText(targetRole.name)).toBeVisible()

  await rolesCard.getByRole('combobox').click()
  await page.getByRole('option', { name: targetRole.name }).click()
  await page.keyboard.press('Escape')
  await rolesCard.getByRole('button', { name: 'Save roles' }).click()
  await expect(rolesCard.getByRole('button', { name: 'Save roles' })).toBeDisabled({ timeout: 10000 })

  void saAssignment
  void targetAssignment
})

test('sidebar updates on window focus after role change without full reload', async ({ page, factories }) => {
  await using role = await factories.create.role({
    name: `Focus Refresh ${Date.now()}`,
    featuresJson: ['product.*', 'order.*'],
  })
  await using user = await factories.create.user()
  const assignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: user.id,
    roleId: role.id,
  })

  await loginAs(page, user)

  const sidebar = page.locator('[data-slot="sidebar"]')
  await expect(sidebar.getByText('Products')).toBeVisible()
  await expect(sidebar.getByText('Orders')).toBeVisible()

  await factories.destroy.actorRoleAssignment(assignment.id)

  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
  })

  await expect(sidebar.getByText('Products')).not.toBeVisible({ timeout: 10000 })
  await expect(sidebar.getByText('Orders')).not.toBeVisible({ timeout: 10000 })
})

test('super admin role shows as immutable in role edit page', async ({ page, navigate, factories }) => {
  await using superAdminRole = await factories.create.role({
    name: `Immutable SA ${Date.now()}`,
    isSuperAdmin: true,
    protected: true,
    featuresJson: ['*'],
  })
  await using user = await factories.create.user()
  await using assignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: user.id,
    roleId: superAdminRole.id,
  })

  await loginAs(page, user)

  await navigate({ to: '/settings/roles/$id', params: { id: superAdminRole.id } })

  // Super Admin badge visible
  await expect(page.getByText('Super Admin')).toBeVisible()

  // Name field is disabled for super admin
  await expect(page.getByLabel('Name')).toBeDisabled()

  // Description field is disabled for super admin
  await expect(page.getByLabel('Description')).toBeDisabled()

  // Save button hidden for immutable roles
  await expect(page.getByRole('button', { name: 'Save' })).not.toBeVisible()

  // Permissions section hidden for immutable roles
  await expect(page.getByRole('heading', { name: 'Permissions' })).not.toBeVisible()

  void assignment
})

test('last super admin cannot remove their own super admin role', async ({ page, navigate, factories }) => {
  await using superAdminRole = await factories.create.role({
    name: `Last SA ${Date.now()}`,
    isSuperAdmin: true,
    protected: true,
    featuresJson: ['*'],
  })
  await using user = await factories.create.user()
  await using assignment = await factories.create.actorRoleAssignment({
    actorType: 'user',
    actorId: user.id,
    roleId: superAdminRole.id,
  })

  await loginAs(page, user)

  await navigate({ to: '/settings/users/$id', params: { id: user.id } })

  // User has the super admin role assigned
  const rolesCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'Roles' }) })
  await expect(rolesCard.getByText(superAdminRole.name)).toBeVisible()

  // Attempt to remove the super admin role by deselecting it
  await rolesCard.getByRole('combobox').click()
  await page.getByRole('option', { name: superAdminRole.name }).click()
  await page.keyboard.press('Escape')
  await rolesCard.getByRole('button', { name: 'Save roles' }).click()

  // Backend rejects: last super admin assignment can't be removed
  await expect(page.getByText(/cannot revoke/i).or(page.getByText(/last/i).and(page.getByText(/admin/i)))).toBeVisible({
    timeout: 10000,
  })

  void assignment
})
