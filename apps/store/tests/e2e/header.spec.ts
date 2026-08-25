import { faker } from '@faker-js/faker'
import { expect, test } from '../setup/test-extend.js'

test.describe('Header', () => {
  test('the rail carries the navigation above lg', async ({ page, authenticate, navigate }) => {
    await authenticate({ as: 'customer' })
    await navigate({ to: '/' })

    // Above lg the rail carries the navigation and there is no hamburger at all
    const header = page.locator('header')
    await expect(header.getByText('Proteus')).toBeVisible()
    await expect(header.getByRole('link', { name: 'Shop all' })).toBeVisible()
    await expect(header.getByLabel('Search products')).toBeVisible()
    await expect(header.getByLabel('Cart').last()).toBeVisible()
    // Rendered but display:none above lg — the rail is the desktop navigation, and the
    // magnifier is redundant next to the inline control. `exact` because the control's own
    // label is "Search products", which a substring match would also pick up.
    await expect(header.getByLabel('Open menu')).not.toBeVisible()
    await expect(header.getByLabel('Search', { exact: true })).not.toBeVisible()

    // The bar's control is a button; the only real input is the one in the panel it opens.
    // The panel is URL state, so opening it is a navigation and back closes it.
    await header.getByLabel('Search products').click()
    const searchPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(page).toHaveURL('/?modal=search')
    await expect(searchPanel).toBeVisible()
    await expect(searchPanel.getByLabel('Search products')).toBeFocused()

    await page.goBack()
    await expect(searchPanel).not.toBeVisible()
    await expect(page).toHaveURL('/')

    // Closing with the ✕ replaces rather than pushes, so back does not reopen it
    await header.getByLabel('Search products').click()
    await searchPanel.getByLabel('Close search').click()
    await expect(searchPanel).not.toBeVisible()
    await expect(page).toHaveURL('/')
  })

  test('the side menu carries the navigation below lg', async ({ page, authenticate, navigate }) => {
    // Explicit viewport: the project runs Desktop Chrome, where the hamburger no longer exists.
    await page.setViewportSize({ width: 390, height: 844 })
    await authenticate({ as: 'customer' })
    await navigate({ to: '/' })

    const header = page.locator('header')
    await expect(header.getByLabel('Open menu')).toBeVisible()
    await expect(header.getByRole('link', { name: 'Shop all' })).not.toBeVisible()

    // The magnifier stands in for the control, which has nowhere to sit at this width, and
    // opens the same panel the desktop button does
    await header.getByLabel('Search', { exact: true }).click()
    const searchPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(page).toHaveURL('/?modal=search')
    await expect(searchPanel.getByLabel('Search products')).toBeFocused()

    // The panel opens onto a merchandised row rather than blank space
    await expect(searchPanel.getByRole('heading', { name: /best sellers/i })).toBeVisible()

    // Mobile dismisses with the back chevron; the ✕ is the desktop affordance and is not
    // rendered at this width
    await expect(searchPanel.getByLabel('Close search')).not.toBeVisible()
    await searchPanel.getByLabel('Back').click()
    await expect(searchPanel).not.toBeVisible()
    await expect(page).toHaveURL('/')

    // Open side menu. Both overlays are drawers, but `modal` is an enum so only one is ever
    // mounted — the shared selector is unambiguous at runtime.
    await header.getByLabel('Open menu').click()
    await expect(page).toHaveURL('/?modal=menu')
    const sideMenu = page.locator('[data-slot="drawer-popup"]')
    await expect(sideMenu).toBeVisible()

    // Side menu carries the expected links
    await expect(sideMenu.getByText('Home')).toBeVisible()
    await expect(sideMenu.getByText('Products')).toBeVisible()
    await expect(sideMenu.getByText('Cart')).toBeVisible()

    // Following a row closes the menu with no explicit dismissal — a plain <Link> drops the
    // search params, and `modal` is one of them
    await sideMenu.getByText('Products').click()
    await expect(page).toHaveURL('/products')
    await expect(sideMenu).not.toBeVisible()

    // Search hands off in a single navigation: the menu closes as the panel opens. Both
    // overlays are mounted for the length of that transition, so the field is addressed by
    // its searchbox role — the drawer selector matches the menu's trigger button too.
    await header.getByLabel('Open menu').click()
    await sideMenu.getByLabel('Search products').click()
    await expect(page).toHaveURL('/products?modal=search')
    await expect(page.getByRole('searchbox', { name: 'Search products' })).toBeFocused()
    await page.keyboard.press('Escape')
  })

  test('the search panel filters, and View all carries the term to the list', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    // Random terms rather than faker product names: the assertion below has to be the only
    // match on the page, and other specs seed products in parallel.
    const matchTerm = faker.string.alpha({ length: 10, casing: 'lower' })
    const otherTerm = faker.string.alpha({ length: 10, casing: 'lower' })
    await using match = await factories.create.product({ status: 'published', title: `${matchTerm} tee` })
    await using other = await factories.create.product({ status: 'published', title: `${otherTerm} cap` })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/products' })

    // Opening the panel is a navigation that keeps the page it opened over — the root-level
    // `modal` param merges with this route's own `q` rather than replacing it.
    await page.locator('header').getByLabel('Search products').click()
    await expect(page).toHaveURL('/products?modal=search')

    const panel = page.locator('[data-slot="drawer-popup"]')
    const search = panel.getByLabel('Search products')
    await search.fill(matchTerm)

    // Results land in the panel itself, debounced, without leaving the page
    await expect(panel.getByText(match.title)).toBeVisible()
    await expect(panel.getByText(other.title)).not.toBeVisible()

    // "View all" carries the same term through to the PLP
    await panel.getByRole('link', { name: new RegExp(`View all.*${matchTerm}`) }).click()

    // Landing on a search with no `modal` is what closes the panel
    await expect(page).toHaveURL(`/products?q=${matchTerm}`)
    await expect(page.locator('[data-slot="drawer-popup"]')).not.toBeVisible()
    await expect(page.getByText(match.title)).toBeVisible()
    await expect(page.getByText(other.title)).not.toBeVisible()
  })
})
