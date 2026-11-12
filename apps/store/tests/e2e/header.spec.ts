import { faker } from '@faker-js/faker'
import { expect, test } from '../setup/test-extend.js'

test.describe('Header', () => {
  test('the rail carries the navigation above lg', async ({ page, authenticate, navigate }) => {
    await authenticate({ as: 'customer' })
    await navigate({ to: '/' })

    // Above lg the rail carries the navigation and there is no hamburger at all
    const header = page.locator('header')
    await expect(header.getByText('Proteus')).toBeVisible()
    await expect(header.getByRole('link', { name: 'Shop all', exact: true })).toBeVisible()
    await expect(header.getByLabel('Search products')).toBeVisible()
    // No `.last()`: the bag is one button at every width now, so a second `aria-label="Cart"`
    // should fail this rather than be silently absorbed.
    await expect(header.getByLabel('Cart')).toBeVisible()
    // Rendered but display:none above lg — the rail is the desktop navigation, and the
    // magnifier is redundant next to the inline control. `exact` because the control's own
    // label is "Search products", which a substring match would also pick up.
    await expect(header.getByLabel('Open menu')).not.toBeVisible()
    await expect(header.getByLabel('Search', { exact: true })).not.toBeVisible()

    // The bar's control is a button; the only real input is the one in the panel it opens.
    // The panel is URL state, so opening it is a navigation and back closes it.
    await header.getByLabel('Search products').click()
    const searchPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(page).toHaveURL('/en-US?modal=search')
    await expect(searchPanel).toBeVisible()
    await expect(searchPanel.getByLabel('Search products')).toBeFocused()

    await page.goBack()
    await expect(searchPanel).not.toBeVisible()
    await expect(page).toHaveURL('/en-US')

    // Closing with the ✕ replaces rather than pushes, so back does not reopen it
    await header.getByLabel('Search products').click()
    await searchPanel.getByLabel('Close search').click()
    await expect(searchPanel).not.toBeVisible()
    await expect(page).toHaveURL('/en-US')
  })

  test('the side menu carries the navigation below lg', async ({ page, authenticate, navigate }) => {
    // Explicit viewport: the project runs Desktop Chrome, where the hamburger no longer exists.
    await page.setViewportSize({ width: 390, height: 844 })
    await authenticate({ as: 'customer' })
    await navigate({ to: '/' })

    const header = page.locator('header')
    await expect(header.getByLabel('Open menu')).toBeVisible()
    await expect(header.getByRole('link', { name: 'Shop all', exact: true })).not.toBeVisible()

    // The magnifier stands in for the control, which has nowhere to sit at this width, and
    // opens the same panel the desktop button does
    await header.getByLabel('Search', { exact: true }).click()
    const searchPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(page).toHaveURL('/en-US?modal=search')
    await expect(searchPanel.getByLabel('Search products')).toBeFocused()

    // The panel opens onto a merchandised row rather than blank space
    await expect(searchPanel.getByRole('heading', { name: /best sellers/i })).toBeVisible()

    // Mobile dismisses with the back chevron; the ✕ is the desktop affordance and is not
    // rendered at this width
    await expect(searchPanel.getByLabel('Close search')).not.toBeVisible()
    await searchPanel.getByLabel('Back').click()
    await expect(searchPanel).not.toBeVisible()
    await expect(page).toHaveURL('/en-US')

    // Open side menu. Both overlays are drawers, but `modal` is an enum so only one is ever
    // mounted — the shared selector is unambiguous at runtime.
    await header.getByLabel('Open menu').click()
    await expect(page).toHaveURL('/en-US?modal=menu')
    const sideMenu = page.locator('[data-slot="drawer-popup"]')
    await expect(sideMenu).toBeVisible()

    // Side menu carries the expected links. No `Cart` row: the bag is in the header at every
    // width, so the menu does not restate it.
    await expect(sideMenu.getByRole('link', { name: 'Shop all', exact: true })).toBeVisible()
    await expect(sideMenu.getByRole('link', { name: 'Account', exact: true })).toBeVisible()

    // Following a row closes the menu with no explicit dismissal — a plain <Link> drops the
    // search params, and `modal` is one of them
    await sideMenu.getByRole('link', { name: 'Shop all', exact: true }).click()
    await expect(page).toHaveURL('/en-US')
    await expect(sideMenu).not.toBeVisible()

    // Search hands off in a single navigation: the menu closes as the panel opens. Both
    // overlays are mounted for the length of that transition, so the field is addressed by
    // its searchbox role — the drawer selector matches the menu's trigger button too.
    await header.getByLabel('Open menu').click()
    await sideMenu.getByLabel('Search products').click()
    await expect(page).toHaveURL('/en-US?modal=search')
    await expect(page.getByRole('searchbox', { name: 'Search products' })).toBeFocused()
    await page.keyboard.press('Escape')
  })

  test("the rail, the side menu and the footer follow the store's menu", async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    // Disposed child-first: a Category with children cannot be deleted.
    await using parent = await factories.create.productCategory()
    await using child = await factories.create.productCategory({ parentId: parent.id })
    // A top-level Visible Category the menu does not name, which a store with no menu would list.
    await using offMenu = await factories.create.productCategory()
    await using collection = await factories.create.productCollection()
    // Declared last so it is restored first. The store is shared, so every other spec that reads
    // the menu asserts only "Shop all", which is on it whatever this sets.
    await using _navigation = await factories.create.storeNavigation([
      { type: 'collection', handle: collection.handle, sections: [] },
      { type: 'category', handle: parent.handle, sections: [] },
      { type: 'category', handle: 'no-such-category', sections: [] },
    ])
    await authenticate({ as: 'customer' })

    await navigate({ to: '/' })

    // The menu's entries in its order, after "Shop all": the unnamed root and the dangling handle are not there.
    const rail = page.locator('header').getByRole('navigation')
    await expect(rail.getByRole('listitem')).toHaveText(['Shop all', collection.title, parent.name])

    // A Category entry expands into its children, as it did when the tree was the menu.
    await rail.getByRole('button', { name: parent.name }).click()
    await expect(page.getByRole('link', { name: `Shop all ${parent.name}` })).toBeVisible()
    await page.getByRole('link', { name: child.name, exact: true }).click()
    await expect(page).toHaveURL(`/en-US/categories/${child.handle}`)

    // A Collection entry links to its page, under its title.
    await rail.getByRole('link', { name: collection.title }).click()
    await expect(page).toHaveURL(`/en-US/collections/${collection.handle}`)
    await expect(page.locator('main').getByRole('heading', { level: 1, name: collection.title })).toBeVisible()

    // The footer's Shop column carries the same top level, flat.
    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: collection.title })).toBeVisible()
    await expect(footer.getByRole('link', { name: parent.name, exact: true })).toBeVisible()
    await expect(footer.getByRole('link', { name: offMenu.name })).toHaveCount(0)

    // Below lg the side menu carries it too, the Category expanding in place.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('header').getByLabel('Open menu').click()
    const sideMenu = page.locator('[data-slot="drawer-popup"]')
    await expect(sideMenu.getByRole('link', { name: collection.title })).toBeVisible()
    await expect(sideMenu.getByText(offMenu.name)).toHaveCount(0)
    await sideMenu.getByRole('button', { name: parent.name }).click()
    await sideMenu.getByRole('link', { name: child.name, exact: true }).click()
    await expect(page).toHaveURL(`/en-US/categories/${child.handle}`)
  })

  test('a menu entry with sections opens a column per section, each link landing on its list filtered', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    await using parent = await factories.create.productCategory()
    await using child = await factories.create.productCategory({ parentId: parent.id })
    await using collection = await factories.create.productCollection()
    await using modelo = await factories.create.productMetafieldDefinition()
    // Priced, because a section's values are those of the products this market sells.
    await using superstar = await factories.create.productWithPricing()
    await using gazelle = await factories.create.productWithPricing()
    for (const product of [superstar, gazelle]) {
      await factories.create.productProductCollection({ productId: product.id, collectionId: collection.id })
    }
    await factories.create.productMetafield({ productId: superstar.id, definitionId: modelo.id, values: ['Superstar'] })
    await factories.create.productMetafield({ productId: gazelle.id, definitionId: modelo.id, values: ['Gazelle'] })
    // Declared last so it is restored first; see the test above.
    await using _navigation = await factories.create.storeNavigation([
      {
        type: 'collection',
        handle: collection.handle,
        sections: [
          { type: 'values', name: 'Models', key: modelo.key, limit: null },
          { type: 'links', name: 'More', links: [{ type: 'category', handle: parent.handle, name: null }] },
        ],
      },
      { type: 'category', handle: parent.handle, sections: [{ type: 'subcategories', name: 'Styles' }] },
    ])
    await authenticate({ as: 'customer' })

    await navigate({ to: '/' })

    // The Collection opens rather than navigates: its own page first, then one titled column per section.
    const rail = page.locator('header').getByRole('navigation')
    await rail.getByRole('button', { name: collection.title }).click()
    await expect(page.getByRole('link', { name: `Shop all ${collection.title}` })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'More' })).toBeVisible()
    await expect(page.getByRole('link', { name: parent.name, exact: true })).toBeVisible()

    // A value lands on the entry's own list, filtered by it.
    await page.getByRole('link', { name: 'Gazelle', exact: true }).click()
    await expect(page).toHaveURL(
      `/en-US/collections/${collection.handle}?filter=${encodeURIComponent(`${modelo.key}:Gazelle`)}`,
    )
    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 3, name: gazelle.title })).toBeVisible()
    await expect(main.getByRole('heading', { level: 3, name: superstar.title })).toBeHidden()

    // A `subcategorias` section is the Category's children, under its title.
    await rail.getByRole('button', { name: parent.name }).click()
    await expect(page.getByRole('heading', { name: 'Styles' })).toBeVisible()
    await page.getByRole('link', { name: child.name, exact: true }).click()
    await expect(page).toHaveURL(`/en-US/categories/${child.handle}`)

    // Below lg each section nests inside its entry's group.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('header').getByLabel('Open menu').click()
    const sideMenu = page.locator('[data-slot="drawer-popup"]')
    await sideMenu.getByRole('button', { name: collection.title }).click()
    await sideMenu.getByRole('button', { name: 'Models' }).click()
    await sideMenu.getByRole('link', { name: 'Superstar', exact: true }).click()
    await expect(page).toHaveURL(
      `/en-US/collections/${collection.handle}?filter=${encodeURIComponent(`${modelo.key}:Superstar`)}`,
    )
    await expect(main.getByRole('heading', { level: 3, name: superstar.title })).toBeVisible()
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
    // Priced, because both the panel and the list behind it are the catalogue this market can
    // quote — a product with no price in its currency never reaches either.
    await using match = await factories.create.productWithPricing({ product: { title: `${matchTerm} tee` } })
    await using other = await factories.create.productWithPricing({ product: { title: `${otherTerm} cap` } })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/' })

    // Opening the panel is a navigation that keeps the page it opened over — the root-level
    // `modal` param merges with this route's own `q` rather than replacing it.
    await page.locator('header').getByLabel('Search products').click()
    await expect(page).toHaveURL('/en-US?modal=search')

    const panel = page.locator('[data-slot="drawer-popup"]')
    const search = panel.getByLabel('Search products')
    await search.fill(matchTerm)

    // Results land in the panel itself, debounced, without leaving the page
    await expect(panel.getByText(match.title)).toBeVisible()
    await expect(panel.getByText(other.title)).not.toBeVisible()

    // "View all" carries the same term through to the PLP
    await panel.getByRole('link', { name: new RegExp(`View all.*${matchTerm}`) }).click()

    // Landing on a search with no `modal` is what closes the panel
    await expect(page).toHaveURL(`/en-US?q=${matchTerm}`)
    await expect(page.locator('[data-slot="drawer-popup"]')).not.toBeVisible()
    await expect(page.getByText(match.title)).toBeVisible()
    await expect(page.getByText(other.title)).not.toBeVisible()
  })
})
