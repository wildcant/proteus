import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreNavigationSection, StoreProductCategoryTreeNode } from '#/api/generated/model'
import type { MenuLinkTo } from '#/components/header/menu'
import type { MenuSource } from '#/components/header/menu-items'
import { Nav } from '#/components/store/nav/nav'
import { I18nTestProvider } from '#/lib/i18n/test-i18n'
import { stringifySearch } from '#/lib/search-params'

/** The links the `_main` layout hands the rail, as plain paths: this router has no such routes. */
const menuLink: MenuLinkTo = (target) => {
  if (!target) return { to: '/' }
  const search = target.filter ? { filter: target.filter } : undefined
  return { to: `/${target.type === 'collection' ? 'collections' : 'categories'}/${target.handle}`, search }
}

/**
 * The rail handed a menu the API already resolved. Mounted in a memory router with the subject as
 * its only route, as `product-card` is: the links are `Link`s, and their hrefs are what is claimed.
 * The app's `stringifySearch` is passed so a filter is written the way the store writes it.
 */
async function renderNav(menu: MenuSource) {
  // The rail is the desktop navigation: below lg it is not displayed at all.
  await page.viewport(1280, 800)
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <Nav menu={menu} menuLink={menuLink} /> }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    stringifySearch,
  })
  // The app's own router type is registered globally; this stub is deliberately not it.
  return render(<RouterProvider router={router as never} />, { wrapper: I18nTestProvider })
}

const category = (handle: string, name: string, children: StoreProductCategoryTreeNode[] = []) => ({
  id: `id-${handle}`,
  name,
  description: '',
  handle,
  children,
})

const classics = category('hombre-clasicos', 'Clásicos')
const men = category('hombre', 'Hombre', [classics])
const women = category('mujer', 'Mujer', [category('mujer-botas', 'Botas')])

test('an entry with sections opens one titled column per section, each link carrying its filter, then its footer', async () => {
  const column = (name: string, extra: Partial<StoreNavigationSection>): StoreNavigationSection => ({
    name,
    display: 'list',
    links: [],
    viewAll: null,
    note: null,
    ...extra,
  })
  await renderNav({
    categories: [men, women],
    collections: [],
    navigation: [
      {
        type: 'category',
        handle: 'hombre',
        sections: [
          column('Estilos', {
            links: [{ label: 'Clásicos', type: 'category', handle: 'hombre-clasicos', filters: [] }],
            viewAll: { label: null, type: 'category', handle: 'hombre', filters: [] },
          }),
          // A brand's column, as a grouped section serves it: closed by a "View all" of that brand.
          column('Nike', {
            links: [
              {
                label: 'Cortez',
                type: 'category',
                handle: 'hombre',
                filters: [
                  { key: 'marca', value: 'Nike' },
                  { key: 'modelo', value: 'Cortez' },
                ],
              },
            ],
            viewAll: { label: 'Nike', type: 'category', handle: 'hombre', filters: [{ key: 'marca', value: 'Nike' }] },
          }),
          column('Talla', {
            display: 'chips',
            links: [
              { label: '42', type: 'category', handle: 'hombre', filters: [{ key: 'option.Talla', value: '42' }] },
            ],
            note: 'Only what comes in your size.',
          }),
        ],
        footer: [{ label: 'All brands', type: 'category', handle: 'hombre', filters: [] }],
      },
      { type: 'category', handle: 'mujer', sections: [], footer: [] },
    ],
  })

  await page.getByRole('button', { name: 'Hombre' }).click()
  // The columns say where "View all" goes, so there is no "Shop all" above them.
  await expect.element(page.getByRole('link', { name: 'Shop all Hombre' })).not.toBeInTheDocument()
  await expect.element(page.getByRole('heading', { name: 'Estilos' })).toBeVisible()
  await expect.element(page.getByRole('heading', { name: 'Talla' })).toBeVisible()
  await expect
    .element(page.getByRole('link', { name: 'Clásicos' }))
    .toHaveAttribute('href', '/categories/hombre-clasicos')
  await expect
    .element(page.getByRole('link', { name: 'View all', exact: true }))
    .toHaveAttribute('href', '/categories/hombre')
  // The list's own `filter` param, repeated for each value.
  await expect
    .element(page.getByRole('link', { name: 'Cortez' }))
    .toHaveAttribute('href', '/categories/hombre?filter=marca%3ANike&filter=modelo%3ACortez')
  await expect
    .element(page.getByRole('link', { name: 'View all Nike' }))
    .toHaveAttribute('href', '/categories/hombre?filter=marca%3ANike')
  await expect
    .element(page.getByRole('link', { name: '42' }))
    .toHaveAttribute('href', '/categories/hombre?filter=option.Talla%3A42')
  await expect.element(page.getByText('Only what comes in your size.')).toBeVisible()
  await expect.element(page.getByRole('link', { name: 'All brands' })).toHaveAttribute('href', '/categories/hombre')
})

test('an entry without sections still opens its child Categories, untitled', async () => {
  await renderNav({
    categories: [men, women],
    collections: [],
    navigation: [{ type: 'category', handle: 'mujer', sections: [], footer: [] }],
  })

  await page.getByRole('button', { name: 'Mujer' }).click()
  await expect.element(page.getByRole('link', { name: 'Botas' })).toHaveAttribute('href', '/categories/mujer-botas')
  await expect.element(page.getByRole('heading')).not.toBeInTheDocument()
})
