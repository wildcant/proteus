import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'
import type { MenuSource } from '#/components/header/menu-items'
import { Nav } from '#/components/store/nav/nav'
import { I18nTestProvider } from '#/lib/i18n/test-i18n'
import { stringifySearch } from '#/lib/search-params'

/**
 * The rail handed a menu the API already resolved. Mounted in a memory router with the subject as
 * its only route, as `product-card` is: the links are `Link`s, and their hrefs are what is claimed.
 * The app's `stringifySearch` is passed so a filter is written the way the store writes it.
 */
async function renderNav(menu: MenuSource) {
  // The rail is the desktop navigation: below lg it is not displayed at all.
  await page.viewport(1280, 800)
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <Nav menu={menu} /> }),
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

test('an entry with sections opens one titled column per section, each link carrying its filter', async () => {
  await renderNav({
    categories: [men, women],
    collections: [],
    navigation: [
      {
        type: 'category',
        handle: 'hombre',
        sections: [
          {
            name: 'Estilos',
            links: [{ label: 'Clásicos', type: 'category', handle: 'hombre-clasicos', filters: [] }],
          },
          {
            name: 'Marcas',
            links: [
              { label: 'Nike', type: 'category', handle: 'hombre', filters: [{ key: 'marca', value: 'Nike' }] },
              {
                label: 'Nike Cortez',
                type: 'category',
                handle: 'hombre',
                filters: [
                  { key: 'marca', value: 'Nike' },
                  { key: 'modelo', value: 'Cortez' },
                ],
              },
            ],
          },
        ],
      },
      { type: 'category', handle: 'mujer', sections: [] },
    ],
  })

  await page.getByRole('button', { name: 'Hombre' }).click()
  await expect
    .element(page.getByRole('link', { name: 'Shop all Hombre' }))
    .toHaveAttribute('href', '/categories/hombre')
  await expect.element(page.getByRole('heading', { name: 'Estilos' })).toBeVisible()
  await expect.element(page.getByRole('heading', { name: 'Marcas' })).toBeVisible()
  await expect
    .element(page.getByRole('link', { name: 'Clásicos' }))
    .toHaveAttribute('href', '/categories/hombre-clasicos')
  // The list's own `filter` param, repeated for each value.
  await expect
    .element(page.getByRole('link', { name: 'Nike', exact: true }))
    .toHaveAttribute('href', '/categories/hombre?filter=marca%3ANike')
  await expect
    .element(page.getByRole('link', { name: 'Nike Cortez' }))
    .toHaveAttribute('href', '/categories/hombre?filter=marca%3ANike&filter=modelo%3ACortez')
})

test('an entry without sections still opens its child Categories, untitled', async () => {
  await renderNav({
    categories: [men, women],
    collections: [],
    navigation: [{ type: 'category', handle: 'mujer', sections: [] }],
  })

  await page.getByRole('button', { name: 'Mujer' }).click()
  await expect.element(page.getByRole('link', { name: 'Botas' })).toHaveAttribute('href', '/categories/mujer-botas')
  await expect.element(page.getByRole('heading')).not.toBeInTheDocument()
})
